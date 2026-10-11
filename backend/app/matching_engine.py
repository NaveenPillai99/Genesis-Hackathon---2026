import re
import json
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models import LostFoundItem, ItemMatchCandidate
from app.auth import send_notification

# Feature Weights
WEIGHT_CATEGORY = 15.0
WEIGHT_TEXT = 30.0
WEIGHT_CHARACTERISTICS = 20.0
WEIGHT_LOCATION = 15.0
WEIGHT_TIME = 15.0
WEIGHT_PHOTO = 5.0

# Thresholds
HIGH_CONFIDENCE_THRESHOLD = 85.0
POSSIBLE_MATCH_THRESHOLD = 65.0

KNOWN_BRANDS_AND_COLORS = {
    "white", "black", "silver", "grey", "gray", "red", "blue", "green", "gold", "yellow",
    "apple", "airpods", "airpod", "sandisk", "samsung", "sony", "dell", "hp", "lenovo",
    "casio", "titan", "fastrack", "wildcraft", "boat", "noise", "logitech", "bose"
}

KNOWN_LOCATIONS = {
    "ab1", "ab2", "ab3", "ab4", "library", "canteen", "cafeteria", "auditorium",
    "ground", "basketball", "football", "gym", "hostel", "mess", "main gate"
}

def clean_tokens(text: Optional[str]) -> set:
    if not text:
        return set()
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    words = cleaned.split()
    stop_words = {"a", "an", "the", "in", "on", "at", "with", "and", "or", "of", "to", "for", "is", "was", "it"}
    return {w for w in words if w not in stop_words and len(w) > 1}

def calculate_time_proximity(date_str_1: Optional[str], date_str_2: Optional[str]) -> float:
    if not date_str_1 or not date_str_2:
        return 8.0  # Fair neutral score when date is missing
    try:
        d1 = datetime.strptime(date_str_1[:10], "%Y-%m-%d")
        d2 = datetime.strptime(date_str_2[:10], "%Y-%m-%d")
        delta = abs((d1 - d2).days)
        if delta == 0:
            return 15.0
        elif delta <= 2:
            return 13.0
        elif delta <= 5:
            return 10.0
        elif delta <= 10:
            return 6.0
        elif delta <= 20:
            return 3.0
        else:
            return 1.0
    except Exception:
        return 8.0

def calculate_match(lost: LostFoundItem, found: LostFoundItem) -> Tuple[float, Dict[str, Any]]:
    """
    Computes a transparent weighted matching score between a lost item report
    and a found item report based on institutional multi-factor rules.
    """
    # 1. Category Agreement (15%)
    cat_score = 0.0
    if lost.category and found.category:
        if lost.category.lower() == found.category.lower():
            cat_score = 15.0
        elif lost.category.lower() in ["other", "accessories"] or found.category.lower() in ["other", "accessories"]:
            cat_score = 7.5
        else:
            cat_score = 0.0
    else:
        cat_score = 7.5

    # 2. Text & Description Similarity (30%)
    lost_text = f"{lost.title} {lost.description or ''}"
    found_text = f"{found.title} {found.description or ''}"
    lost_tokens = clean_tokens(lost_text)
    found_tokens = clean_tokens(found_text)

    overlap = lost_tokens.intersection(found_tokens)
    union = lost_tokens.union(found_tokens)
    text_ratio = len(overlap) / max(len(union), 1)

    # Keyword boost if key product terms match exactly (e.g. "airpods", "calculator")
    title_overlap = clean_tokens(lost.title).intersection(clean_tokens(found.title))
    title_boost = 0.0
    if len(title_overlap) >= 1:
        title_boost = 10.0

    raw_text_score = min(30.0, (text_ratio * 25.0) + title_boost)

    # 3. Colour, Brand & Characteristics (20%)
    lost_chars = f"{lost.characteristics or ''} {lost.description or ''} {lost.title}".lower()
    found_chars = f"{found.characteristics or ''} {found.description or ''} {found.title}".lower()

    lost_char_tokens = clean_tokens(lost_chars)
    found_char_tokens = clean_tokens(found_chars)

    matched_attributes = [
        attr for attr in KNOWN_BRANDS_AND_COLORS
        if (attr in lost_char_tokens or attr in lost_chars) and (attr in found_char_tokens or attr in found_chars)
    ]

    if len(matched_attributes) >= 2:
        char_score = 20.0
    elif len(matched_attributes) == 1:
        char_score = 15.0
    else:
        # Check if characteristics fields are empty
        if not lost.characteristics and not found.characteristics:
            char_score = 10.0  # Neutral score if unstated
        else:
            char_score = 4.0

    # 4. Location Compatibility (15%)
    lost_loc = (lost.location_found or "").lower()
    found_loc = (found.location_found or "").lower()

    loc_score = 0.0
    matched_locs = [loc for loc in KNOWN_LOCATIONS if loc in lost_loc and loc in found_loc]

    if matched_locs or (lost_loc and found_loc and (lost_loc in found_loc or found_loc in lost_loc)):
        loc_score = 15.0
    elif any(loc in lost_loc or loc in found_loc for loc in KNOWN_LOCATIONS):
        # Known campus locations but in different areas
        loc_score = 5.0
    else:
        loc_score = 7.5  # Neutral

    # 5. Date & Time Proximity (15%)
    time_score = calculate_time_proximity(lost.found_date, found.found_date)

    # 6. Photograph Availability (5%)
    photo_score = 0.0
    has_photo_1 = bool(lost.photo_url)
    has_photo_2 = bool(found.photo_url)
    if has_photo_1 and has_photo_2:
        photo_score = 5.0
    elif has_photo_1 or has_photo_2:
        photo_score = 2.5
    else:
        photo_score = 0.0

    raw_sum = cat_score + raw_text_score + char_score + loc_score + time_score + photo_score

    # Normalize missing photograph penalization
    if not has_photo_1 and not has_photo_2:
        normalized_score = round(min(100.0, (raw_sum / 95.0) * 100.0), 1)
    else:
        normalized_score = round(min(100.0, raw_sum), 1)

    confidence = "LOW"
    if normalized_score >= HIGH_CONFIDENCE_THRESHOLD:
        confidence = "HIGH"
    elif normalized_score >= POSSIBLE_MATCH_THRESHOLD:
        confidence = "POSSIBLE"

    component_details = {
        "category_score": round(cat_score, 1),
        "text_similarity_score": round(raw_text_score, 1),
        "characteristics_score": round(char_score, 1),
        "location_score": round(loc_score, 1),
        "time_proximity_score": round(time_score, 1),
        "photo_score": round(photo_score, 1),
        "matched_attributes": matched_attributes,
        "matched_locations": matched_locs,
        "normalized_score": normalized_score,
        "confidence_level": confidence,
    }

    return normalized_score, component_details

def run_cross_department_matching(db: Session, target_item: LostFoundItem) -> list:
    """
    Executes bidirectional cross-department matching for an active target item.
    - If target_item is 'lost', compares against active 'found' reports across ALL departments.
    - If target_item is 'found', compares against active 'lost' reports across ALL departments.
    Enforces uniqueness so existing pairs are updated rather than duplicated.
    """
    if target_item.status in ["returned", "recovered", "closed", "cancelled"]:
        return []

    is_target_lost = target_item.report_type == "lost"
    opp_type = "found" if is_target_lost else "lost"

    candidates = db.query(LostFoundItem).filter(
        LostFoundItem.report_type == opp_type,
        LostFoundItem.status.notin_(["returned", "recovered", "closed", "cancelled"])
    ).all()

    results = []

    for opp in candidates:
        lost_item = target_item if is_target_lost else opp
        found_item = opp if is_target_lost else target_item

        score, breakdown = calculate_match(lost_item, found_item)

        # Check existing match candidate to enforce uniqueness
        existing_candidate = db.query(ItemMatchCandidate).filter(
            ItemMatchCandidate.lost_report_id == lost_item.id,
            ItemMatchCandidate.found_report_id == found_item.id
        ).first()

        already_notified = False
        if existing_candidate and existing_candidate.review_status in ["notified", "confirmed_match", "dismissed"]:
            already_notified = True

        review_status = existing_candidate.review_status if existing_candidate else "pending_review"

        if existing_candidate:
            existing_candidate.match_score = score
            existing_candidate.component_scores = json.dumps(breakdown)
            existing_candidate.last_calculated_at = datetime.utcnow()
            match_record = existing_candidate
        else:
            match_record = ItemMatchCandidate(
                lost_report_id=lost_item.id,
                found_report_id=found_item.id,
                match_score=score,
                component_scores=json.dumps(breakdown),
                review_status=review_status,
                last_calculated_at=datetime.utcnow()
            )
            db.add(match_record)

        db.commit()
        db.refresh(match_record)

        # Send Notifications for High & Possible matches (Only if not already notified)
        if score >= POSSIBLE_MATCH_THRESHOLD and not already_notified:
            dest_dept = found_item.destination_department_name or "Department Office"
            if "welfare" in dest_dept.lower():
                office_name = "Office of Student Welfare"
            elif "cse" in dest_dept.lower() or "computer" in dest_dept.lower():
                office_name = "CSE Department office"
            elif "math" in dest_dept.lower():
                office_name = "Mathematics Department office"
            elif "ece" in dest_dept.lower():
                office_name = "ECE Department office"
            elif "mech" in dest_dept.lower():
                office_name = "Mechanical Department office"
            else:
                office_name = f"{dest_dept} office"

            # 1. Private notification to Owner of Lost Report (Safe template, Section 5)
            msg_to_owner = (
                f"A found item with a similar description to your lost-item report has been submitted to the {dest_dept}. "
                f"Please visit the {office_name} with your college ID card to verify ownership and collect the item if it is confirmed to be yours. "
                f"The department will verify your identity before releasing the item."
            )

            send_notification(
                db=db,
                recipient_id=lost_item.finder_id,  # finder_id is owner_id for lost items
                title="Possible Lost Item Match",
                message=msg_to_owner,
                category="lost_found",
                link="/lost-found"
            )

            # 2. Notification to Responsible Department Handler
            if found_item.assigned_handler_id:
                conf_label = breakdown.get("confidence_level", "POSSIBLE")
                msg_to_handler = (
                    f"Match Alert ({conf_label} Confidence): Potential match detected for found item '{found_item.title}' in your department custody. "
                    f"Please review the case in your handler console and verify claimant identity in person using their College ID card."
                )
                send_notification(
                    db=db,
                    recipient_id=found_item.assigned_handler_id,
                    title=f"Potential Match Candidate: {dest_dept}",
                    message=msg_to_handler,
                    category="lost_found",
                    link="/lost-found"
                )

            # Update match record review_status and lost item status
            match_record.review_status = "notified"
            if lost_item.status == "active":
                lost_item.status = "potential_match"
            db.commit()

        results.append({
            "candidate_id": match_record.id,
            "lost_item_id": lost_item.id,
            "found_item_id": found_item.id,
            "match_score": score,
            "breakdown": breakdown,
        })

    return results

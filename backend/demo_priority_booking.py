"""
CampusConnect Standalone Priority-Based Slot Booking & Alternative Recommendation Demo
Demonstrates:
  1. Priority formula: P = (0.60 * R) + (0.40 * E)
  2. Competing requests comparison: Dean's HOD meeting vs Faculty seminar
  3. Deterministic ranking and recommendation
  4. Stage A & B Feasible Alternative Venues
  5. Stage C Alternate Time Windows
"""

from app.booking_engine import (
    calculate_booking_priority,
    get_booking_policy,
    calculate_alternative_suitability_score,
    find_alternative_venues,
    find_alternative_time_slots,
)

def run_demo():
    print("=" * 80)
    print(" CampusConnect Priority Booking & Alternative Recommendation Engine")
    print("=" * 80)

    # 1. Configured Policy
    policy = get_booking_policy()
    print(f"\n[1] ACTIVE POLICY: Version {policy.version}")
    print(f"    Formula: P = ({policy.role_weight:.2f} * R) + ({policy.purpose_weight:.2f} * E)")
    print(f"    Sample Role Scores (R):")
    for r in ["campus_director", "dean", "principal", "hod", "faculty", "class_rep", "student"]:
        print(f"      - {r:16}: {policy.role_scores.get(r):5.1f} pts")

    print(f"    Sample Purpose Scores (E):")
    for p, sc in list(policy.purpose_scores.items())[:5]:
        print(f"      - {p:24}: {sc:5.1f} pts")

    # 2. Benchmark Case: Dean vs Faculty for the Same Slot
    print("\n" + "=" * 80)
    print("[2] COMPETING REQUEST BENCHMARK: Dean vs Faculty for Same Slot")
    print("=" * 80)

    dean_res = calculate_booking_priority(role="dean", event_purpose="Meeting / Discussion")
    fac_res = calculate_booking_priority(role="faculty", event_purpose="Seminar")

    print(f"\n  Request A: Dean's HOD Meeting")
    print(f"    - Role: Dean (R = {dean_res['role_score']})")
    print(f"    - Purpose: Meeting / Discussion (E = {dean_res['purpose_score']})")
    print(f"    - Calculation: {dean_res['formula']}")
    print(f"    - Priority Score (P): {dean_res['combined_priority_score']} / 100")

    print(f"\n  Request B: Faculty Seminar")
    print(f"    - Role: Faculty (R = {fac_res['role_score']})")
    print(f"    - Purpose: Seminar (E = {fac_res['purpose_score']})")
    print(f"    - Calculation: {fac_res['formula']}")
    print(f"    - Priority Score (P): {fac_res['combined_priority_score']} / 100")

    print("\n  RESOLUTION:")
    if dean_res["combined_priority_score"] > fac_res["combined_priority_score"]:
        diff = dean_res["combined_priority_score"] - fac_res["combined_priority_score"]
        print(f"    >>> Rank 1: Request A (Dean) with P={dean_res['combined_priority_score']} -> RECOMMEND_APPROVAL")
        print(f"    >>> Rank 2: Request B (Faculty) with P={fac_res['combined_priority_score']} (-{diff:.1f} pts) -> RECOMMEND_ALTERNATIVES")

    # 3. Alternative Venue Recommendations for the Lower-Priority Request
    print("\n" + "=" * 80)
    print("[3] INTELLIGENT ALTERNATIVE RECOMMENDATIONS (For Faculty Seminar)")
    print("=" * 80)

    class DemoRoom:
        def __init__(self, id, name, building, capacity, has_projector=True, has_ac=True, has_audio=True):
            self.id = id
            self.name = name
            self.building = building
            self.capacity = capacity
            self.type = "event_venue"
            self.has_projector = has_projector
            self.has_ac = has_ac
            self.has_audio = has_audio
            self.is_under_maintenance = False

    preferred_room = DemoRoom("VENUE-AUDITORIUM", "Amriteshwari Auditorium", "Academic Block 1", 1200)
    candidate_rooms = [
        preferred_room,
        DemoRoom("VENUE-SEMINAR-AB1", "Seminar Hall AB1", "Academic Block 1", 150),
        DemoRoom("VENUE-AMPHITHEATRE", "Open Air Amphitheatre", "Central Campus", 800),
        DemoRoom("VENUE-HALL-AB2", "Multi-Purpose Hall AB2", "Academic Block 2", 200),
    ]

    alt_venues = find_alternative_venues(
        all_rooms=candidate_rooms,
        preferred_room_id=preferred_room.id,
        event_date="2026-11-20",
        start_slot="slot4",
        end_slot="slot6",
        expected_audience=120,
        confirmed_bookings=[],
        timetable_slots=[],
        requires_projector=True,
        limit=3
    )

    print("\n  Stage A & B: Ranked Feasible Alternative Venues (Same Slot):")
    for i, v in enumerate(alt_venues, 1):
        print(f"    {i}. {v['venue_name']} ({v['building']})")
        print(f"       Capacity: {v['capacity']} seats | Suitability Score: {v['suitability_score']}%")
        print(f"       Breakdown: Cap={v['component_breakdown']['capacity']}%, Equip={v['component_breakdown']['equipment']}%, Type={v['component_breakdown']['event_type']}%, Loc={v['component_breakdown']['location']}%")
        print(f"       Explanation: {v['explanation']}")

    # 4. Stage C: Alternate Time Windows
    alt_times = find_alternative_time_slots(
        preferred_room=preferred_room,
        event_date="2026-11-20",
        start_slot="slot4",
        end_slot="slot6",
        expected_audience=120,
        confirmed_bookings=[],
        horizon_days=2,
        limit=3
    )

    print("\n  Stage C: Alternate Time Slots for Preferred Venue:")
    for i, t in enumerate(alt_times, 1):
        print(f"    {i}. Date: {t['event_date']} | Slots: {t['start_slot']} - {t['end_slot']} ({t['time_range']})")
        print(f"       Suitability Score: {t['suitability_score']}% | {t['explanation']}")

    print("\n" + "=" * 80)
    print(" DEMONSTRATION COMPLETE: Constraints Validated & Alternatives Ranked!")
    print("=" * 80)

if __name__ == "__main__":
    run_demo()

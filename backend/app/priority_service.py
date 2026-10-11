import math
from datetime import datetime, date
from typing import Dict, Any, Optional, Tuple, Union
from pydantic import BaseModel, Field

# ==============================================================================
# CONFIGURATION & POLICY WEIGHTS
# ==============================================================================

# 1. Role Weights for People (Normalized to [0.0, 1.0])
DEFAULT_ROLE_WEIGHTS: Dict[str, float] = {
    "hod": 1.00,
    "department_head": 1.00,
    "sys_admin": 0.95,
    "resource_admin": 0.90,
    "faculty": 0.75,
    "hpc_faculty": 0.75,
    "class_advisor": 0.70,
    "lab_admin": 0.65,
    "lost_property_handler": 0.60,
    "lab_assistant": 0.50,
    "class_rep": 0.45,
    "student": 0.30,
}
DEFAULT_ROLE_FALLBACK: float = 0.30

# 2. Event Level Weights (Normalized to [0.0, 1.0])
DEFAULT_EVENT_LEVEL_WEIGHTS: Dict[str, float] = {
    "university": 1.00,
    "department": 0.70,
    "club": 0.40,
}
DEFAULT_EVENT_LEVEL_FALLBACK: float = 0.40

# 3. Event Factor Feature Weights (Must sum to 1.0)
DEFAULT_EVENT_FEATURE_WEIGHTS: Dict[str, float] = {
    "level": 0.35,
    "academic": 0.25,
    "audience": 0.15,
    "urgency": 0.15,
    "stakeholder": 0.10,
}

# 4. Audience Normalization Range
DEFAULT_MIN_AUDIENCE: int = 10
DEFAULT_MAX_AUDIENCE: int = 500

# 5. Sigmoid Hyperparameters
DEFAULT_CUTOFF: float = 0.60
DEFAULT_STEEPNESS: float = 10.0


class PriorityPolicy:
    """
    Configurable policy settings for Sigmoid-based binary priority scoring.
    All factors and weights can be adjusted without modifying algorithm logic.
    """
    def __init__(
        self,
        cutoff: float = DEFAULT_CUTOFF,
        steepness: float = DEFAULT_STEEPNESS,
        role_weights: Optional[Dict[str, float]] = None,
        event_level_weights: Optional[Dict[str, float]] = None,
        event_feature_weights: Optional[Dict[str, float]] = None,
        min_audience: int = DEFAULT_MIN_AUDIENCE,
        max_audience: int = DEFAULT_MAX_AUDIENCE,
    ):
        self.cutoff = cutoff
        self.steepness = steepness
        self.role_weights = dict(role_weights or DEFAULT_ROLE_WEIGHTS)
        self.event_level_weights = dict(event_level_weights or DEFAULT_EVENT_LEVEL_WEIGHTS)
        self.event_feature_weights = dict(event_feature_weights or DEFAULT_EVENT_FEATURE_WEIGHTS)
        self.min_audience = min_audience
        self.max_audience = max_audience

    def reset_defaults(self):
        self.cutoff = DEFAULT_CUTOFF
        self.steepness = DEFAULT_STEEPNESS
        self.role_weights = dict(DEFAULT_ROLE_WEIGHTS)
        self.event_level_weights = dict(DEFAULT_EVENT_LEVEL_WEIGHTS)
        self.event_feature_weights = dict(DEFAULT_EVENT_FEATURE_WEIGHTS)
        self.min_audience = DEFAULT_MIN_AUDIENCE
        self.max_audience = DEFAULT_MAX_AUDIENCE


# Global active policy instance
active_policy = PriorityPolicy()


def get_active_policy() -> PriorityPolicy:
    return active_policy


# ==============================================================================
# MATHEMATICAL PRIMITIVES
# ==============================================================================

def clamp(val: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Clamps a floating point number to [min_val, max_val]."""
    try:
        if math.isnan(val):
            return min_val
        return max(min_val, min(max_val, float(val)))
    except (TypeError, ValueError):
        return min_val


def sigmoid(score: float, cutoff: float = DEFAULT_CUTOFF, steepness: float = DEFAULT_STEEPNESS) -> float:
    """
    Computes: sigmoid(S) = 1 / (1 + exp(-steepness * (score - cutoff)))
    Guarantees numerical stability against overflow/underflow.
    """
    safe_score = clamp(score, 0.0, 1.0)
    z = -float(steepness) * (safe_score - float(cutoff))
    if z > 80.0:
        return 0.0
    if z < -80.0:
        return 1.0
    return 1.0 / (1.0 + math.exp(z))


def to_binary_priority(sigmoid_val: float) -> int:
    """
    priority = 1 if sigmoid(S) >= 0.5, otherwise priority = 0.
    Returns exactly integer 0 or 1.
    """
    return 1 if sigmoid_val >= 0.5 else 0


# ==============================================================================
# PEOPLE PRIORITY SCORING
# ==============================================================================

def calculate_people_priority(
    role: Optional[str],
    policy: Optional[PriorityPolicy] = None,
) -> Dict[str, Any]:
    """
    Assigns role-based priority score using authenticated user's verified role.
    
    Formula:
      S = role_weight (in [0, 1])
      sigmoid(S) = 1 / (1 + exp(-k * (S - S_0)))
      priority = 1 if sigmoid(S) >= 0.5 else 0
      
    Returns:
      priority: 0 or 1
      raw_score: S
      sigmoid_confidence: sigmoid(S)
      priority_label: 'High Priority' or 'Normal Priority'
    """
    pol = policy or get_active_policy()
    
    # Clean and validate role input
    clean_role = str(role or "").strip().lower()
    role_weight = pol.role_weights.get(clean_role, DEFAULT_ROLE_FALLBACK)
    raw_score = clamp(role_weight, 0.0, 1.0)
    
    sig_val = sigmoid(raw_score, cutoff=pol.cutoff, steepness=pol.steepness)
    binary_priority = to_binary_priority(sig_val)
    
    return {
        "priority": binary_priority,
        "priority_label": "High Priority" if binary_priority == 1 else "Normal Priority",
        "raw_score": round(raw_score, 4),
        "sigmoid_confidence": round(sig_val, 4),
        "cutoff": pol.cutoff,
        "steepness": pol.steepness,
        "role": clean_role,
        "role_weight": role_weight,
    }


# ==============================================================================
# EVENT PRIORITY SCORING
# ==============================================================================

def normalize_audience(
    audience: Any,
    min_audience: int = DEFAULT_MIN_AUDIENCE,
    max_audience: int = DEFAULT_MAX_AUDIENCE
) -> float:
    """
    Normalizes expected audience size to [0, 1] over [min_audience, max_audience].
    Safely handles negative or invalid values without artificially inflating priority.
    """
    try:
        aud = int(audience)
    except (TypeError, ValueError):
        return 0.0
    
    if aud <= min_audience:
        return 0.0
    if max_audience <= min_audience:
        return 1.0
    return clamp((aud - min_audience) / (max_audience - min_audience), 0.0, 1.0)


def calculate_urgency(
    event_date: Optional[Union[str, date, datetime]],
    reference_date: Optional[Union[date, datetime]] = None
) -> float:
    """
    Calculates urgency based on event date relative to reference date (default: today).
    Events with closer dates have higher urgency because venue booking
    requires immediate administrative resolution.
    
    Urgency tiers:
      <= 3 days: 1.00
      <= 7 days: 0.80
      <= 14 days: 0.60
      <= 30 days: 0.40
      > 30 days: 0.20
      Past / invalid: 0.00
    """
    if not event_date:
        return 0.0
    
    ref_dt = reference_date or date.today()
    if isinstance(ref_dt, datetime):
        ref_dt = ref_dt.date()
        
    evt_dt: Optional[date] = None
    if isinstance(event_date, datetime):
        evt_dt = event_date.date()
    elif isinstance(event_date, date):
        evt_dt = event_date
    elif isinstance(event_date, str):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y"):
            try:
                evt_dt = datetime.strptime(event_date.strip(), fmt).date()
                break
            except ValueError:
                continue
                
    if not evt_dt:
        return 0.0
        
    days_ahead = (evt_dt - ref_dt).days
    if days_ahead < 0:
        return 0.0  # Past dates cannot have high urgency
    if days_ahead <= 3:
        return 1.00
    if days_ahead <= 7:
        return 0.80
    if days_ahead <= 14:
        return 0.60
    if days_ahead <= 30:
        return 0.40
    return 0.20


def calculate_stakeholder_participation(
    has_external_guests: bool = False,
    organizer_role: Optional[str] = None
) -> float:
    """
    Normalizes verified participation by important institutional stakeholders.
    - External guests / VIPs: 1.00
    - Institutional leadership organizer (HOD, Admin): 1.00
    - Faculty organizer: 0.80
    - Advisor / Lab Admin organizer: 0.60
    - Otherwise: 0.00
    """
    if bool(has_external_guests):
        return 1.00
    
    role = str(organizer_role or "").strip().lower()
    if role in ("hod", "department_head", "sys_admin", "resource_admin"):
        return 1.00
    if role in ("faculty", "hpc_faculty"):
        return 0.80
    if role in ("class_advisor", "lab_admin"):
        return 0.60
    return 0.00


def calculate_event_priority(
    level: Optional[str],
    is_academic: Union[bool, float] = True,
    expected_audience: Any = 100,
    event_date: Optional[Union[str, date, datetime]] = None,
    has_external_guests: bool = False,
    organizer_role: Optional[str] = None,
    reference_date: Optional[Union[date, datetime]] = None,
    policy: Optional[PriorityPolicy] = None,
) -> Dict[str, Any]:
    """
    Calculates event priority from configurable normalized factors:
      - Event level: University (1.00), Department (0.70), Club (0.40)
      - Academic importance & institutional relevance: [0, 1]
      - Expected audience size: normalized over [min_audience, max_audience]
      - Urgency based on event date: [0, 1]
      - Verified stakeholder participation: [0, 1]
      
    Feature weights sum to 1.0:
      S = sum(weight_i * feature_i)
      sigmoid(S) = 1 / (1 + exp(-k * (S - S_0)))
      priority = 1 if sigmoid(S) >= 0.5 else 0
    """
    pol = policy or get_active_policy()
    
    # 1. Event Level Feature
    clean_level = str(level or "").strip().lower()
    f_level = pol.event_level_weights.get(clean_level, DEFAULT_EVENT_LEVEL_FALLBACK)
    f_level = clamp(f_level, 0.0, 1.0)
    
    # 2. Academic Importance Feature
    if isinstance(is_academic, bool):
        f_academic = 1.00 if is_academic else 0.00
    else:
        f_academic = clamp(is_academic, 0.0, 1.0)
        
    # 3. Expected Audience Feature
    f_audience = normalize_audience(expected_audience, pol.min_audience, pol.max_audience)
    
    # 4. Urgency Feature
    f_urgency = calculate_urgency(event_date, reference_date)
    
    # 5. Stakeholder Participation Feature
    f_stakeholder = calculate_stakeholder_participation(has_external_guests, organizer_role)
    
    # Feature weights (normalized to sum to 1.0)
    fw = pol.event_feature_weights
    w_sum = sum(fw.values())
    w_level = fw.get("level", 0.35) / w_sum
    w_academic = fw.get("academic", 0.25) / w_sum
    w_audience = fw.get("audience", 0.15) / w_sum
    w_urgency = fw.get("urgency", 0.15) / w_sum
    w_stakeholder = fw.get("stakeholder", 0.10) / w_sum
    
    # Calculate normalized weighted score S
    raw_score = (
        w_level * f_level +
        w_academic * f_academic +
        w_audience * f_audience +
        w_urgency * f_urgency +
        w_stakeholder * f_stakeholder
    )
    raw_score = clamp(raw_score, 0.0, 1.0)
    
    # Apply Sigmoid
    sig_val = sigmoid(raw_score, cutoff=pol.cutoff, steepness=pol.steepness)
    binary_priority = to_binary_priority(sig_val)
    
    breakdown = {
        "level": {
            "value": clean_level,
            "normalized": round(f_level, 4),
            "weight": round(w_level, 4),
            "contribution": round(w_level * f_level, 4),
        },
        "academic": {
            "value": bool(is_academic),
            "normalized": round(f_academic, 4),
            "weight": round(w_academic, 4),
            "contribution": round(w_academic * f_academic, 4),
        },
        "audience": {
            "value": expected_audience,
            "normalized": round(f_audience, 4),
            "weight": round(w_audience, 4),
            "contribution": round(w_audience * f_audience, 4),
        },
        "urgency": {
            "value": str(event_date) if event_date else None,
            "normalized": round(f_urgency, 4),
            "weight": round(w_urgency, 4),
            "contribution": round(w_urgency * f_urgency, 4),
        },
        "stakeholder": {
            "has_external_guests": bool(has_external_guests),
            "organizer_role": organizer_role,
            "normalized": round(f_stakeholder, 4),
            "weight": round(w_stakeholder, 4),
            "contribution": round(w_stakeholder * f_stakeholder, 4),
        },
    }
    
    return {
        "priority": binary_priority,
        "priority_label": "High Priority" if binary_priority == 1 else "Normal Priority",
        "raw_score": round(raw_score, 4),
        "sigmoid_confidence": round(sig_val, 4),
        "cutoff": pol.cutoff,
        "steepness": pol.steepness,
        "breakdown": breakdown,
    }

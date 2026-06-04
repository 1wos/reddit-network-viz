"""
Ontology contract (Python mirror of src/ontology/types/*).

Same ontology governs BOTH planes — the JS query/runtime and this Python
ingestion service — so extracted facts validate against one shared schema
(the "one contract for the whole loop" invariant).
"""

# Concrete object types (abstract Entity/Signal omitted) and their required props.
OBJECT_TYPES = {
    "Subreddit":       {"pk": "name",     "required": ["name"]},
    "Author":          {"pk": "username", "required": ["username"]},
    "RedditPost":      {"pk": "id",       "required": ["id", "title"]},
    "Topic":           {"pk": "id",       "required": ["id", "label"]},
    "Organization":    {"pk": "id",       "required": ["id", "label"]},
    "Product":         {"pk": "id",       "required": ["id", "label"]},
    "Person":          {"pk": "id",       "required": ["id", "label"]},
    "AssetOrTicker":   {"pk": "id",       "required": ["id", "label"]},
    "Event":           {"pk": "id",       "required": ["id", "label", "eventType"]},
    "SentimentSignal": {"pk": "id",       "required": ["id", "label", "magnitude", "direction"]},
    "RiskSignal":      {"pk": "id",       "required": ["id", "label", "magnitude", "riskType"]},
}

LINK_TYPES = {
    "POSTED_IN", "AUTHORED_BY", "MENTIONS", "DISCUSSED_IN", "CO_OCCURS_WITH",
    "RELATED_TO_EVENT", "IMPACTS", "ESCALATES", "CONTRADICTS", "TRENDING_WITH", "EVIDENCED_BY",
}


def validate_instances(extraction: dict):
    """Drop anything that violates the contract. Returns (cleaned, errors)."""
    errors = []
    objects, ids = [], set()
    for o in extraction.get("objects", []):
        t = o.get("type")
        if t not in OBJECT_TYPES:
            errors.append(f"unknown object type: {t}")
            continue
        missing = [p for p in OBJECT_TYPES[t]["required"] if not o.get(p)]
        if missing:
            errors.append(f"{o.get('id')}: missing {missing}")
            continue
        objects.append(o)
        ids.add(o.get("id") or o.get("name"))

    links = []
    for l in extraction.get("links", []):
        if l.get("type") not in LINK_TYPES:
            errors.append(f"unknown link type: {l.get('type')}")
            continue
        if l.get("source") not in ids or l.get("target") not in ids:
            errors.append(f"dangling link {l.get('source')}->{l.get('target')}")
            continue
        links.append(l)

    return {"objects": objects, "links": links}, errors

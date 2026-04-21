import json
import re
import logging
from groq import Groq
import os

logger = logging.getLogger(__name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SECTION_KEYWORDS = {
    "academic": [
        "marks", "grade", "score", "subject", "exam", "result",
        "attendance", "marksheet", "math", "science", "english",
        "pass", "fail", "total", "percentage", "academic", "section"
    ],
    "admissions": [
        "admission", "fee", "fees", "payment", "enroll",
        "register", "joining", "revenue", "collection"
    ],
    "faculty": [
        "faculty", "teacher", "staff", "employee", "department",
        "designation", "salary", "experience", "subject_taught"
    ],
    "placements": [
        "placement", "job", "company", "package", "offer",
        "recruit", "campus", "hired", "career", "salary_offered"
    ]
}

# ✅ what each section should focus on
SECTION_FOCUS = {
    "academic": """
Focus ONLY on academic performance metrics:
- Student marks/scores by subject or section
- Attendance rates by class or section  
- Pass/fail distribution
- Top performing students
- Average marks by subject
NEVER show blood group, address, contact, or personal info charts.
All charts must have MAX 10-12 data points only.
""",
    "admissions": """
Focus ONLY on admission and enrollment metrics:
- Number of students admitted per class
- Gender distribution of admitted students
- Category-wise (General/SC/ST/OBC) distribution
- Transport route usage
- Year-wise admission trends
NEVER show blood group, marks, or academic performance.
All charts must have MAX 10-12 data points only.
""",
    "faculty": """
Focus ONLY on faculty and staff metrics:
- Department-wise staff count
- Subject-wise teacher distribution
- Designation breakdown
- Experience levels
NEVER show student data.
All charts must have MAX 10 data points only.
""",
    "placements": """
Focus ONLY on placement metrics:
- Placed vs unplaced students
- Company-wise placement count
- Package ranges offered
- Department-wise placement rate
NEVER show academic marks or attendance.
All charts must have MAX 10 data points only.
"""
}


def detect_section(table_name: str, columns: list) -> str:
    combined = (table_name + " " + " ".join(columns)).lower()
    scores = {
        section: sum(1 for kw in keywords if kw in combined)
        for section, keywords in SECTION_KEYWORDS.items()
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "academic"


def get_section_tables(section: str, all_tables: list, get_schema_fn, skip_tables: list) -> list:
    relevant = []
    for table in all_tables:
        if table in skip_tables:
            continue
        schema = get_schema_fn(table)
        columns = []
        for line in schema.split('\n'):
            line = line.strip()
            if line.startswith('-') and '"' in line:
                try:
                    col = line.split('"')[1]
                    columns.append(col)
                except:
                    continue
        detected = detect_section(table, columns)
        if detected == section:
            relevant.append(table)
            logger.info(f"Table '{table}' → section '{section}'")
    return relevant


def generate_section_analytics(section: str, schema: str, samples: list) -> dict:
    compact_samples = []
    for s in samples:
        compact_samples.append({
            "table": s["table"],
            "rows": s["rows"][:2]
        })

    focus = SECTION_FOCUS.get(section, "")

    prompt = f"""
You are a school data analyst building charts for a {section} dashboard.

{focus}

Schema:
{schema[:1500]}

Sample rows:
{str(compact_samples)[:800]}

Return ONLY this JSON, no explanation:
{{
  "charts": [
    {{
      "title": "Clear title a school principal can understand",
      "sql": "SELECT \\"col\\", COUNT(*) FROM \\"table\\" GROUP BY \\"col\\" ORDER BY COUNT(*) DESC LIMIT 10",
      "chart_type": "bar"
    }}
  ],
  "risks": [
    "Specific risk found in the data that needs attention"
  ],
  "recommendations": [
    "Specific actionable recommendation based on the data"
  ]
}}

Rules:
- Maximum 3 charts
- Every chart SQL must have LIMIT 10 to avoid too many data points
- Use GROUP BY queries only — never SELECT *
- Use exact column names from schema in \\"tablename\\".\\"columnname\\" format
- chart_type: bar for comparisons, pie for distributions (max 6 slices), line for trends
- Titles must be simple and clear like "Students per Class" not "Distribution Analysis"
- Return ONLY valid JSON
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "You are a school data analyst. Return only valid JSON. No markdown."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=700
        )

        raw = response.choices[0].message.content
        raw = re.sub(r"```json|```", "", raw).strip()
        result = json.loads(raw)
        logger.info(f"Section {section} — {len(result.get('charts', []))} charts generated")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed for {section}: {e}")
        return {"charts": [], "risks": [], "recommendations": []}
    except Exception as e:
        logger.error(f"Section analytics failed for {section}: {e}")
        return {"charts": [], "risks": [], "recommendations": []}

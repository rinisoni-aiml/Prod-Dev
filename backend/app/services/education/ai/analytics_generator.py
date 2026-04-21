import json
import os
import re
import logging
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY")
)

analytics_prompt = PromptTemplate(
    input_variables=["schema", "sample_rows"],
    template="""
You are an expert school analytics AI helping school administrators improve student outcomes.

Schema:
{schema}

Available Tables and Columns (USE ONLY THESE EXACT TABLE NAMES):
{sample_rows}

CRITICAL SQL RULES:
- Use ONLY the exact table names listed above — never invent table names
- Always wrap table and column names in double quotes: "tablename"."columnname"
- Every insight MUST have a working sql_query
- Return ONLY valid JSON, no markdown, no explanation

YOUR GOAL:
Generate SPECIFIC, ACTIONABLE insights that help school management:
1. Identify students/classes at risk
2. Find attendance problems
3. Spot academic performance gaps
4. Highlight fee collection issues
5. Flag faculty concerns

For each insight, the sql_query should return DATA that can be VISUALIZED in a chart.

Good insight example:
- "Bottom 5 classes by average attendance" → bar chart of class vs attendance %
- "Subject-wise average marks comparison" → bar chart of subjects vs avg marks  
- "Monthly fee collection trend" → line chart of month vs amount collected
- "Students scoring below 40% by class" → bar chart of class vs count of at-risk students
- "Top performing vs bottom performing classes" → bar chart comparison

Good recommendation example:
- "Class 8B has 23 students with attendance below 60% - Schedule parent meetings immediately"
- "Science marks dropped 15% compared to last term - Review teaching methodology"
- "₹2.3L in fees pending from 45 students - Send reminders before month end"

Return this exact JSON with 6 insights and 4 recommendations:
{{
  "insights": [
    {{
      "domain": "Academics | Attendance | Fees | Faculty",
      "title": "Short specific title",
      "detail": "Specific finding with numbers if possible",
      "sql_query": "SELECT ... FROM \\"exact_table_name\\" ...",
      "chart_type": "bar | line | pie",
      "severity": "warning | critical | positive | info"
    }}
  ],
  "recommendations": [
    {{
      "priority": "critical | high | medium",
      "domain": "Academics | Attendance | Fees | Faculty",
      "title": "Short action title",
      "detail": "Specific problem description with numbers",
      "action": "Exact step to take to fix this problem"
    }}
  ]
}}
"""
)


def compress_schema(schema: str) -> str:
    lines = schema.split("\n")
    compressed = []
    for line in lines:
        line = line.strip()
        if line:
            compressed.append(line)
    return "\n".join(compressed)[:2000]


def compress_samples(sample_rows: list) -> str:
    result = []
    for s in sample_rows:
        table = s.get("table", "")
        cols = s.get("columns", [])
        result.append(f"{table}: {', '.join(str(c) for c in cols[:20])}")
    return "\n".join(result)


def generate_analytics(schema, sample_rows):
    compressed_schema = compress_schema(schema)
    compressed_samples = compress_samples(sample_rows)

    logger.info(f"Schema chars: {len(compressed_schema)}")
    logger.info(f"Sample chars: {len(compressed_samples)}")

    chain = analytics_prompt | llm

    try:
        response = chain.invoke({
            "schema": compressed_schema,
            "sample_rows": compressed_samples
        })

        raw = response.content
        logger.info(f"Analytics LLM raw response:\n{raw}")

        raw = re.sub(r"```json", "", raw)
        raw = re.sub(r"```", "", raw)
        raw = raw.strip()

        # Extract JSON if wrapped in text
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            raw = json_match.group()

        insights = json.loads(raw)
        logger.info("✅ Analytics parsed successfully")
        return insights

    except Exception as e:
        logger.error(f"❌ Failed to parse analytics JSON: {e}")
        return {"insights": [], "recommendations": []}
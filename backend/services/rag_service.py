import os
import re
import math
from typing import List, Dict, Any, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from .llm_service import llm_service

# Collection of default HR Policy & Workforce Knowledge Documents
HR_DOCUMENTS = [
    {
        "doc_id": "POLICY_HR_001",
        "title": "General HR Code of Conduct & Workplace Policy",
        "category": "HR Policy",
        "content": (
            "Employees are expected to work 40 standard hours per week (Monday through Friday, 09:00 to 17:30). "
            "All employees are entitled to regular break periods totaling 60 minutes daily. "
            "Remote work options require prior approval from the direct manager and HR Administrator. "
            "Confidentiality of workforce data and client details must be maintained under GDPR guidelines. "
            "Violation of workplace security policies or unauthorized attendance spoofing will trigger disciplinary review."
        )
    },
    {
        "doc_id": "POLICY_LEAVE_002",
        "title": "Leave & Time Off Policy Guidelines",
        "category": "Leave Policy",
        "content": (
            "Annual leave allotment is 15 paid days per full calendar year, accrued monthly. "
            "Sick leave allows up to 5 days with full pay annually. A medical certificate is required for absences exceeding 2 consecutive days. "
            "Leave requests must be submitted through the portal at least 3 business days in advance for annual leaves. "
            "Emergency leave requests are automatically flagged for manager express review. "
            "Unused annual leave up to 5 days can be carried forward into the next calendar year."
        )
    },
    {
        "doc_id": "POLICY_ATT_003",
        "title": "Attendance, Shift Scheduling & Geofence Policy",
        "category": "Attendance Policy",
        "content": (
            "Attendance check-in is required within 15 minutes of shift start time (e.g. by 09:15 AM). "
            "Check-ins after 09:15 AM are classified as 'Late Arrival'. Accumulating 3 late arrivals within a calendar month triggers an automated attendance alert. "
            "Mobile check-ins require GPS geofencing verification within 500 meters of designated office coordinates or approved remote work site. "
            "Overtime requires prior manager approval and is compensated at 1.5x standard hourly rate for hours exceeding 40 hours per week."
        )
    },
    {
        "doc_id": "POLICY_PAY_004",
        "title": "Payroll Processing & Compensation Guidelines",
        "category": "Payroll Policy",
        "content": (
            "Payroll is processed monthly on the 28th of each calendar month. "
            "Gross pay includes base salary, overtime multipliers, and approved performance incentives or bonuses. "
            "Deductions include statutory taxes, unpaid leave deductions, and benefits contributions. "
            "Payslips are published online on the Employee Portal immediately following payroll batch execution. "
            "Direct deposit updates must be requested at least 7 days prior to payroll cutoff date."
        )
    },
    {
        "doc_id": "POLICY_SKILL_005",
        "title": "Learning & Skill Development Program",
        "category": "Training Documentation",
        "content": (
            "Employees receive a annual professional development budget of $1,500 for certified courses and technical training. "
            "Skill gap assessments are conducted bi-annually. High-priority training recommendations (e.g., Senior Engineering SQL/Python certifications, "
            "Leadership for Product Design) receive 100% tuition coverage upon approval. "
            "Course completion updates must be submitted to the Skills Matrix dashboard within 14 days."
        )
    },
    {
        "doc_id": "REPORT_WF_006",
        "title": "Workforce Performance & Attrition Insights Report 2026",
        "category": "Workforce Report",
        "content": (
            "Engineering and Product Design exhibit high workload intensity, averaging over 15 hours of overtime per employee per month. "
            "Key drivers for attrition risk include unmitigated overtime, low annual leave utilization (<40%), and lack of skill growth pathways. "
            "Recommended retention interventions include workload rebalancing via contractor augmentation, proactive 1-on-1 retention syncs, "
            "and immediate approval of pending leave requests."
        )
    }
]

class RAGService:
    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self.tfidf_matrix = None
        self._build_index()

    def _chunk_text(self, text: str, max_words: int = 40) -> List[str]:
        words = text.split()
        chunks = []
        for i in range(0, len(words), max_words):
            chunks.append(" ".join(words[i:i + max_words]))
        return chunks

    def _build_index(self):
        """Chunk documents, build vector representations, and store embeddings."""
        self.chunks = []
        for doc in HR_DOCUMENTS:
            doc_chunks = self._chunk_text(doc["content"])
            for idx, chunk in enumerate(doc_chunks):
                self.chunks.append({
                    "chunk_id": f"{doc['doc_id']}_c{idx}",
                    "doc_id": doc["doc_id"],
                    "title": doc["title"],
                    "category": doc["category"],
                    "content": chunk,
                    "full_doc": doc["content"]
                })
        
        chunk_texts = [c["content"] for c in self.chunks]
        if chunk_texts:
            self.tfidf_matrix = self.vectorizer.fit_transform(chunk_texts)

    def add_document(self, doc_id: str, title: str, category: str, content: str):
        HR_DOCUMENTS.append({
            "doc_id": doc_id,
            "title": title,
            "category": category,
            "content": content
        })
        self._build_index()

    def retrieve(self, query: str, top_k: int = 3, threshold: float = 0.1) -> List[Dict[str, Any]]:
        """Retrieve top-k relevant document chunks based on vector similarity."""
        if not self.chunks or self.tfidf_matrix is None:
            return []
        
        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        
        # Rank by score
        top_indices = similarities.argsort()[::-1][:top_k]
        results = []
        for idx in top_indices:
            score = similarities[idx]
            if score >= threshold:
                chunk_info = self.chunks[idx].copy()
                chunk_info["similarity_score"] = round(float(score), 4)
                results.append(chunk_info)
        
        return results

    def answer_query(self, query: str, top_k: int = 3) -> Dict[str, Any]:
        """
        RAG Pipeline:
        User Question -> Retrieve relevant chunks -> Build context -> LLM -> Grounded answer
        """
        retrieved_chunks = self.retrieve(query, top_k=top_k)
        
        if not retrieved_chunks:
            return {
                "answer": f"Information regarding '{query}' is currently unavailable in HR policy documentation.",
                "retrieved_chunks": [],
                "grounded": False
            }
            
        context_blocks = []
        for c in retrieved_chunks:
            context_blocks.append(f"[{c['category']} - {c['title']}]\n{c['content']}")
        
        context_str = "\n\n".join(context_blocks)
        
        system_prompt = (
            "You are an expert HR Policy & Workforce Intelligence Assistant. "
            "Answer the user's question accurately using ONLY the provided document context. "
            "If the information is not present in the context, explicitly state that the information is unavailable."
        )
        
        answer = llm_service.generate_response(
            system_prompt=system_prompt,
            user_query=query,
            context=context_str
        )
        
        return {
            "answer": answer,
            "retrieved_chunks": retrieved_chunks,
            "grounded": True
        }

rag_service = RAGService()

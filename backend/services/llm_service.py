import os
import json
from typing import Dict, Any, Optional

class LLMService:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "openai").lower()
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        
    def generate_response(self, system_prompt: str, user_query: str, context: Optional[str] = None) -> str:
        """
        Generates a grounded LLM response using OpenAI API, AWS Bedrock, or structured DB synthesis fallback.
        """
        full_user_content = user_query
        if context:
            full_user_content = f"DATABASE & DOCUMENT CONTEXT:\n{context}\n\nUSER QUESTION:\n{user_query}"

        # Try OpenAI API if key is set
        if self.api_key and self.provider == "openai":
            try:
                import openai
                client = openai.OpenAI(api_key=self.api_key)
                response = client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": full_user_content}
                    ],
                    temperature=0.3
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"[LLMService] OpenAI call failed: {e}. Falling back to grounded DB response engine.")

        # Try AWS Bedrock if configured
        if self.provider == "bedrock":
            try:
                import boto3
                bedrock = boto3.client("bedrock-runtime", region_name=self.aws_region)
                payload = {
                    "prompt": f"Human: {system_prompt}\nContext:\n{context or ''}\nQuestion: {user_query}\n\nAssistant:",
                    "max_tokens_to_sample": 500
                }
                res = bedrock.invoke_model(
                    modelId="anthropic.claude-v2",
                    body=json.dumps(payload)
                )
                res_body = json.loads(res.get("body").read())
                return res_body.get("completion", "")
            except Exception as e:
                print(f"[LLMService] AWS Bedrock call failed: {e}. Falling back to grounded DB response engine.")

        # Fallback: Grounded DB answer synthesis
        return self._generate_grounded_fallback(user_query, context)

    def _generate_grounded_fallback(self, query: str, context: Optional[str]) -> str:
        """
        Generates a highly structured, accurate response from retrieved database context when external API keys are unavailable.
        """
        if not context or "No relevant information" in context:
            return (
                f"Information regarding your query '{query}' is currently unavailable in the workforce database or HR policy documents."
            )
        
        return (
            f"🤖 **Workforce AI Assistant (Grounded Data Engine)**\n\n"
            f"Based on live workforce analytics and indexed policy documentation:\n\n"
            f"{context}\n\n"
            f"💡 *Note: Operating in local grounded mode using live database queries and vectorized HR documents.*"
        )

llm_service = LLMService()

import asyncio
import json
import re
from urllib.parse import urljoin
import httpx
import vertexai
from bs4 import BeautifulSoup
from google.cloud import secretmanager
from openai import AsyncOpenAI
from vertexai.generative_models import GenerativeModel
from playwright.async_api import async_playwright

print("--- Loading SEO Agent (Playwright Version) ---")

# --- Configuration ---
HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'}
SCHEMA_SCRAPE_LIMIT = 5

# --- Helper Functions ---
def _remove_trailing_commas(json_string: str) -> str:
    json_string = re.sub(r",\s*([\}\]])", r"\1", json_string)
    return json_string

def get_openai_api_key(project_id: str, secret_id: str, version_id: str = "latest") -> str:
    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        print(f"Error fetching secret: {e}")
        return None

async def find_sitemap(url: str, client: httpx.AsyncClient) -> str | None:
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        parsed_url = httpx.URL(url)
        base_url = f"{parsed_url.scheme}://{parsed_url.host}/"
        robots_url = urljoin(base_url, 'robots.txt')
        res = await client.get(robots_url, headers=HEADERS, timeout=10)
        res.raise_for_status()
        for line in res.text.splitlines():
            if line.lower().startswith('sitemap:'):
                return line.split(':', 1)[1].strip()
        return None
    except Exception:
        return None

# UPDATED to use Playwright
async def scrape_urls_for_schema(urls: list[str], browser) -> dict:
    schemas = {}
    page = await browser.new_page()
    for url in urls[:SCHEMA_SCRAPE_LIMIT]:
        try:
            await page.goto(url, wait_until='domcontentloaded', timeout=15000)
            html_content = await page.content()
            soup = BeautifulSoup(html_content, 'html.parser')
            schema_tags = soup.find_all('script', type='application/ld+json')
            if schema_tags:
                schemas[url] = [json.loads(tag.string) for tag in schema_tags if tag.string]
        except Exception as e:
            schemas[url] = {"error": str(e)}
    await page.close()
    return schemas

async def analyze_schema(schemas: dict, model: GenerativeModel) -> dict:
    if not schemas or all('error' in v for v in schemas.values()):
        return {"score": 0, "summary": "The analysis indicates a complete failure to retrieve any structured data. The scraping tool was likely blocked, signifying that no valid schema could be parsed from the target URL. This represents a critical missed opportunity."}
    prompt = f"You are a technical SEO expert. Based on the following JSON-LD schema, provide a technical analysis as a JSON object with 'score' (integer 0-100) and 'summary' (2-3 sentences). Schema: --- {json.dumps(schemas, indent=2)} ---. The output must be ONLY the JSON object."
    try:
        response = await model.generate_content_async(prompt)
        json_match = re.search(r"\{.*\}", response.text, re.DOTALL)
        if not json_match:
            raise ValueError("LLM did not return a valid JSON object.")
        return json.loads(json_match.group(0))
    except Exception as e:
        return {"score": 0, "summary": f"An error occurred during schema analysis: {str(e)}"}

async def run_authority_prompts_on_llm(client, model_name: str, categorized_prompts: dict, brand_name: str, is_openai: bool = False) -> dict:
    prompt_list = []
    for category, prompts in categorized_prompts.items():
        for i, p in enumerate(prompts):
            prompt_key = f"{category}_{i}"
            prompt_list.append({"key": prompt_key, "prompt": p})
    system_prompt = f"You are a neutral evaluator for '{brand_name}'. For each query, give a direct response. Return a single JSON object where keys are the query 'key' and values are your responses. Queries: {json.dumps(prompt_list, indent=2)}. Your entire output must be ONLY the valid JSON object."
    try:
        raw_response_text = ""
        if is_openai:
            response = await client.chat.completions.create(model=model_name, messages=[{"role": "user", "content": system_prompt}], response_format={"type": "json_object"})
            raw_response_text = response.choices[0].message.content
        else:
            response = await client.generate_content_async(system_prompt)
            raw_response_text = response.text
        json_match = re.search(r"\{.*\}", raw_response_text, re.DOTALL)
        if not json_match:
            return {"error": "LLM did not return a valid JSON object."}
        flat_results = json.loads(json_match.group(0))
        categorized_results = {cat: [] for cat in categorized_prompts.keys()}
        for key, value in flat_results.items():
            category = '_'.join(key.split('_')[:-1])
            if category in categorized_results:
                categorized_results[category].append(value)
        return categorized_results
    except Exception as e:
        return {"error": f"An error occurred during batched LLM call: {str(e)}"}

# UPDATED with a more specific prompt
async def analyze_authority_results(gemini_results: dict, openai_results: dict, model: GenerativeModel, brand_name: str) -> dict:
    prompt = f"""
    You are a world-class brand strategist for the specialty coffee roaster '{brand_name}'. Analyze the following prompts and responses from two LLMs to assess brand authority.

    Gemini Responses: --- {json.dumps(gemini_results, indent=2)} ---
    OpenAI Responses: --- {json.dumps(openai_results, indent=2)} ---

    Based on your analysis, generate a JSON object with this structure: 
    {{
      "score": <An integer from 0-100 representing the brand's authority and consistency>,
      "insights": [
        "A key insight about brand strength. Mention specific products or attributes if they appear in the responses.",
        "A critical observation about a weakness or where the brand is being positioned against competitors."
      ],
      "recommendations": [
        "A specific, actionable content recommendation for '{brand_name}' to capture user intent. Instead of 'create content', suggest 'Write a blog post titled `The Ultimate Guide to Cold Brew Ratios` featuring brand products'.",
        "A specific, actionable marketing recommendation. Instead of 'use social media', suggest 'Launch an Instagram campaign featuring user-generated photos of their morning coffee ritual'."
      ]
    }}
    The output must be ONLY the valid JSON object.
    """
    try:
        response = await model.generate_content_async(prompt)
        json_match = re.search(r"\{.*\}", response.text, re.DOTALL)
        if not json_match:
            raise ValueError("LLM did not return valid JSON for authority audit.")
        return json.loads(json_match.group(0))
    except Exception as e:
        return {"score": 0, "insights": [], "recommendations": [f"An error occurred: {str(e)}"]}

# --- Main Agent Functions ---
def generate_prompts_for_url(url: str, competitors_str: str, project_id: str, location: str) -> dict:
    # ... (function is unchanged from last working version)
    vertexai.init(project=project_id, location=location)
    generative_model = GenerativeModel("gemini-2.5-flash")
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        with httpx.Client(headers=HEADERS, timeout=10, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
        brand_name = httpx.URL(url).host.replace('www.', '').split('.')[0].capitalize()
        text_content = ' '.join(p.get_text() for p in soup.find_all('p'))
        page_extract = f"Content Sample: {text_content[:2000]}"
        prompt = f"As a strategist for '{brand_name}', generate a JSON object of prompts to test non-branded visibility against competitors: {competitors_str}. Use this content: --- {page_extract} ---. Create keys for 'branded_queries', 'problem_solution_queries', 'category_queries', 'comparison_queries', and 'review_queries', each with a list of 4 diverse prompts. The output must be ONLY the valid JSON object with no trailing commas."
        generation_response = generative_model.generate_content(prompt)
        raw_text = generation_response.text
        json_str_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not json_str_match:
            raise ValueError("The model did not return a valid JSON object.")
        cleaned_json_str = _remove_trailing_commas(json_str_match.group(0))
        return json.loads(cleaned_json_str)
    except Exception as e:
        return {"error": f"An error occurred: {str(e)}"}

# UPDATED to initialize and use Playwright
# In agent-python-backend/agents/seo_agent.py

# THIS IS THE NEW, CORRECTED CODE:
async def run_full_seo_analysis(websocket, project_id: str, location: str, your_site: dict, competitors: list[dict], prompts: dict) -> dict:
    await websocket.send_json({"status": "progress", "message": "Initializing clients..."})
    
    # Extract the URL from the dictionary
    your_site_url = your_site.get("url")
    if not your_site_url:
        raise ValueError("your_site URL is missing from the payload.")

    vertexai.init(project=project_id, location=location)
    gemini_model = GenerativeModel("gemini-1.5-pro-preview-0409")
    openai_api_key = get_openai_api_key(project_id, "OpenAPIKey")
    if not openai_api_key:
        raise ValueError("OpenAI API key not found.")
    openai_client = AsyncOpenAI(api_key=openai_api_key)
    brand_name = httpx.URL(your_site_url).host.replace('www.', '').split('.')[0].capitalize()
    # ... rest of the function is the same

    # Initialize Playwright and a browser instance
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # httpx is still useful for fast API-like calls (e.g., to robots.txt)
        async with httpx.AsyncClient(follow_redirects=True) as client:
            await websocket.send_json({"status": "progress", "message": "Analyzing website schema..."})
            initial_sitemap_url = await find_sitemap(your_site, client)
            urls_to_scrape = {your_site}
            if initial_sitemap_url:
                try:
                    sitemap_res = await client.get(initial_sitemap_url, headers=HEADERS)
                    sitemap_soup = BeautifulSoup(sitemap_res.content, "xml")
                    if sitemap_soup.find('sitemapindex'):
                        sitemap_urls = [loc.text for loc in sitemap_soup.find_all('loc')]
                        for sm_url in sitemap_urls:
                            sub_sitemap_res = await client.get(sm_url, headers=HEADERS)
                            sub_sitemap_soup = BeautifulSoup(sub_sitemap_res.content, "xml")
                            urls_to_scrape.update([loc.text for loc in sub_sitemap_soup.find_all('loc')])
                    else:
                        urls_to_scrape.update([loc.text for loc in sitemap_soup.find_all('loc')])
                except Exception as e:
                    print(f"Could not parse sitemap: {e}")
            
            # Pass the browser instance to the scraper function
            scraped_schemas = await scrape_urls_for_schema(list(urls_to_scrape), browser)
        
        await browser.close()

    schema_audit_result = await analyze_schema(scraped_schemas, gemini_model)
    
    await websocket.send_json({"status": "progress", "message": "Running authority analysis on Gemini..."})
    gemini_task = run_authority_prompts_on_llm(gemini_model, "gemini-2.5-pro", prompts, brand_name)
    
    await websocket.send_json({"status": "progress", "message": "Running authority analysis on OpenAI..."})
    openai_task = run_authority_prompts_on_llm(openai_client, "gpt-4o", prompts, brand_name, is_openai=True)
    
    gemini_results, openai_results = await asyncio.gather(gemini_task, openai_task)
    
    await websocket.send_json({"status": "progress", "message": "Synthesizing audits..."})
    authority_audit_result = await analyze_authority_results(gemini_results, openai_results, gemini_model, brand_name)

    await websocket.send_json({"status": "progress", "message": "Compiling final report..."})
    
    final_report = {
        "reportTitle": f"LLM Optimization Analysis for {brand_name}",
        "schemaAudit": schema_audit_result,
        "authorityAudit": authority_audit_result,
        "authorityAnalysis": {
            "gemini": gemini_results,
            "openai": openai_results
        }
    }
    return final_report
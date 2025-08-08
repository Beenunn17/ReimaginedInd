import vertexai
from vertexai.generative_models import GenerativeModel, Part
import re
import json
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import base64

async def analyze_url_with_playwright(url: str) -> dict:
    """
    Uses Playwright to fetch text content AND take a screenshot of a URL.
    This version is optimized for speed.
    """
    text_content = f"Could not fetch text content from {url}"
    screenshot_b64 = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # --- THIS IS THE OPTIMIZATION ---
            # 1. Increased timeout to 20 seconds to handle slow pages.
            # 2. Changed 'wait_until' to 'domcontentloaded' which is much faster 
            #    than 'networkidle' as it doesn't wait for tracking scripts.
            await page.goto(url, timeout=20000, wait_until='domcontentloaded')
            
            # Take a screenshot after the DOM is loaded
            screenshot_bytes = await page.screenshot(full_page=True)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')

            # Get the page content
            html_content = await page.content()
            await browser.close()
            
            soup = BeautifulSoup(html_content, 'html.parser')
            for script_or_style in soup(["script", "style"]):
                script_or_style.decompose()
            raw_text = soup.get_text()
            lines = (line.strip() for line in raw_text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text_content = '\n'.join(chunk for chunk in chunks if chunk)
            
    except Exception as e:
        error_message = f"Playwright failed to fetch {url}: {e}"
        print(error_message)
        text_content = error_message
        
    return {"text": text_content, "screenshot": screenshot_b64}


async def analyze_brand_with_llm(
    project_id: str,
    location: str,
    brand_name: str,
    website_url: str,
    ad_library_url: str,
    user_brief: str
) -> dict:
    """
    Performs multimodal analysis if possible, with a graceful fallback to text-only.
    """
    print(f"Starting analysis for brand: {brand_name}")
    vertexai.init(project=project_id, location=location)
    model = GenerativeModel("gemini-2.5-pro") 

    website_analysis = await analyze_url_with_playwright(website_url)
    website_content = website_analysis["text"]
    website_screenshot_b64 = website_analysis["screenshot"]

    ad_library_content = "No Ad Library URL provided."
    if ad_library_url:
        ad_library_analysis = await analyze_url_with_playwright(ad_library_url)
        ad_library_content = ad_library_analysis["text"]

    prompt_content = [
        f"You are a world-class brand strategist. Your task is to analyze the provided information and develop three distinct creative strategies."
        f"\n\n**CONTEXT:**"
        f"\n- **User's Creative Brief:** \"{user_brief}\""
        f"\n- **Website Text Content:** \"{website_content[:2000]}\""
        f"\n- **Ad Library Text Content:** \"{ad_library_content[:2000]}\""
    ]

    if website_screenshot_b64:
        print("Screenshot successful. Performing MULTIMODAL analysis...")
        image_part = Part.from_data(data=base64.b64decode(website_screenshot_b64), mime_type="image/png")
        prompt_content.insert(0, image_part)
        prompt_content.insert(1, "\n\n**ANALYSIS TASK (Based on the Screenshot and Text):**" \
                                 "\n1. **Visual Style:** Look at the screenshot. Describe the brand's visual language, color palette, and typography." \
                                 "\n2. **Brand Voice:** Read the text. Describe the writing style and tone.")
    else:
        print("Screenshot failed. Falling back to TEXT-ONLY analysis...")
        prompt_content.append("\n\n**ANALYSIS TASK (Based on the Text):**" \
                              "\n**Brand Voice:** Read the text content. Describe the writing style and tone.")

    prompt_content.append("\n\n**CREATIVE TASK:**" \
                          "\nNow, generate three creative strategy approaches that align with the brand. For each approach, provide a Title, a Core Idea, and a Description." \
                          "\nFormat your response as a valid JSON object with a single key \"approaches\". Do not include your analysis, only the final JSON.")

    try:
        print("Sending prompt to the Gemini LLM...")
        response = model.generate_content(prompt_content) 
        raw_llm_text = response.text
        
        json_match = re.search(r'\{.*\}', raw_llm_text, re.DOTALL)
        if not json_match:
            raise ValueError(f"LLM did not return valid JSON. Raw response: {raw_llm_text}")
        
        json_string = json_match.group(0)
        json.loads(json_string)
        
        return { "llm_response": json_string }
    except Exception as e:
        print(f"LLM generation or parsing failed: {e}")
        return {"error": f"LLM generation failed: {e}"}
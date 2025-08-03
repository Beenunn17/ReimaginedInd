print("🔥 Starting main.py")

import pandas as pd
import json
import os
import asyncio
import httpx
from fastapi import FastAPI, Form, HTTPException, WebSocket, Request # Make sure Request is imported
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from fastapi.responses import JSONResponse

# Import agent functions
from agents.data_science_agent import run_standard_agent, run_follow_up_agent
from agents.seo_agent import find_sitemap, generate_prompts_for_url, run_full_seo_analysis
from agents.creative_agent import generate_ad_creative
from agents import brand_strategist_agent
from agents import creative_director_agent
from agents import copywriter_agent

# --- Configuration & Initialization ---
PROJECT_ID = "braidai"
LOCATION = "us-central1"
MODEL_NAME = "gemini-2.5-pro"
DATA_DIR = "./data/"

app = FastAPI()

# This allows your frontend to communicate with your backend
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SEO Agent Endpoints ---
@app.post("/validate-sitemaps")
async def validate_sitemaps_endpoint(urls: list = Form(...)):
    results = []
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [find_sitemap(url, client) for url in urls]
        sitemap_locations = await asyncio.gather(*tasks)
        for url, sitemap_loc in zip(urls, sitemap_locations):
            if sitemap_loc:
                results.append({"url": url, "status": "found", "sitemap_url": sitemap_loc})
            else:
                results.append({"url": url, "status": "not_found", "sitemap_url": None})
    return {"results": results}

@app.post("/generate-prompts")
async def get_generated_prompts(url: str = Form(...), competitors: str = Form("")):
    categorized_prompts = generate_prompts_for_url(url, competitors, PROJECT_ID, LOCATION)
    if 'error' in categorized_prompts:
        raise HTTPException(status_code=500, detail=categorized_prompts['error'])
    return {"prompts": categorized_prompts}

@app.websocket("/ws/seo-analysis")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        your_site, competitors, prompts = data.get("yourSite"), data.get("competitors", []), data.get("prompts")
        if not your_site or not prompts:
            await websocket.send_json({"status": "error", "message": "Missing site URL or prompts."})
            return
        final_report = await run_full_seo_analysis(websocket, PROJECT_ID, LOCATION, your_site, competitors, prompts)
        await websocket.send_json({"status": "complete", "report": final_report})
    except Exception as e:
        error_message = f"An unexpected error occurred: {str(e)}"
        print(error_message)
        await websocket.send_json({"status": "error", "message": error_message})
    finally:
        await websocket.close()

# --- Creative Agent Endpoint ---
@app.post("/generate-creative")
async def generate_creative_endpoint(
    platform: str = Form(...),
    customSubject: str = Form(...),
    sceneDescription: str = Form(...),
    imageType: str = Form(...),
    style: str = Form(...),
    camera: str = Form(...),
    lighting: str = Form(...),
    composition: str = Form(...),
    modifiers: str = Form(...),
    negativePrompt: str = Form(...),
    subjectImage: Optional[str] = Form(None),
    sceneImage: Optional[str] = Form(None)
):
    prompt_components = {
        "customSubject": customSubject,
        "sceneDescription": sceneDescription,
        "imageType": imageType,
        "style": style,
        "camera": camera,
        "lighting": lighting,
        "composition": composition,
        "modifiers": modifiers,
        "negativePrompt": negativePrompt
    }
    asset_data = generate_ad_creative(
        project_id=PROJECT_ID,
        location=LOCATION,
        platform=platform,
        prompt_components=prompt_components,
        subject_image_b64=subjectImage,
        scene_image_b64=sceneImage
    )
    if asset_data:
        return asset_data
    raise HTTPException(status_code=500, detail="Failed to generate creative.")

# --- Data Science Agent Endpoints ---
@app.get("/preview/{dataset_filename}")
async def get_data_preview(dataset_filename: str):
    filepath = os.path.join(DATA_DIR, dataset_filename)
    df = pd.read_csv(filepath)
    df = df.round(2)
    return json.loads(df.head().to_json(orient='split'))

@app.post("/analyze")
async def analyze_data(dataset_filename: str = Form(...), prompt: str = Form(...)):
    filepath = os.path.join(DATA_DIR, dataset_filename)
    dataframe = pd.read_csv(filepath)
    result = run_standard_agent(dataframe, prompt, PROJECT_ID, LOCATION, MODEL_NAME)
    return result

@app.post("/follow-up")
async def follow_up_analysis(
    dataset_filename: str = Form(...),
    original_prompt: str = Form(...),
    follow_up_history: str = Form(...),
    follow_up_prompt: str = Form(...)
):
    filepath = os.path.join(DATA_DIR, dataset_filename)
    dataframe = pd.read_csv(filepath)
    history_list = json.loads(follow_up_history)
    history_str = ""
    for turn in history_list:
        if turn.get('sender') == 'user':
            history_str += f"User: {turn.get('text')}\n"
        elif turn.get('sender') == 'agent':
            history_str += f"Agent: {turn.get('summary')}\n"
    result = run_follow_up_agent(dataframe, original_prompt, history_str, follow_up_prompt, PROJECT_ID, LOCATION, MODEL_NAME)
    return result

# --- Brand Strategist Endpoint ---
@app.post("/analyze-brand")
async def analyze_brand_endpoint(request: Request):
    """
    Endpoint to trigger the brand strategist agent for LLM-based analysis.
    """
    try:
        form_data = await request.form()
        brand_name = form_data.get("brandName")
        website_url = form_data.get("websiteUrl")
        ad_library_url = form_data.get("adLibraryUrl")
        user_brief = form_data.get("userBrief")

        if not brand_name or not website_url or not user_brief:
            raise HTTPException(status_code=400, detail="Brand name, Website URL, and a brief are required.")

        # --- THIS IS THE IMPORTANT CHANGE ---
        # Add 'await' because the agent function is now async
        analysis_data = await brand_strategist_agent.analyze_brand_with_llm(
            project_id=PROJECT_ID,
            location=LOCATION,
            brand_name=brand_name,
            website_url=website_url,
            ad_library_url=ad_library_url,
            user_brief=user_brief
        )
        
        if analysis_data.get("error"):
             raise HTTPException(status_code=500, detail=analysis_data["error"])

        return JSONResponse(content=analysis_data)

    except Exception as e:
        print(f"Error in /analyze-brand endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-assets-from-brief")
async def generate_assets_endpoint(request: Request):
    try:
        data = await request.json()
        
        # Extract all the necessary data from the request
        brand_name = data.get("brandName")
        website_url = data.get("websiteUrl")
        ad_library_url = data.get("adLibraryUrl")
        user_brief = data.get("userBrief")
        selected_strategy = data.get("selectedStrategy")

        if not all([brand_name, website_url, user_brief, selected_strategy]):
            raise HTTPException(status_code=400, detail="Missing required data for asset generation.")

        # Call the new Creative Director agent
        asset_results = await creative_director_agent.brief_to_prompts_and_assets(
            project_id=PROJECT_ID,
            location=LOCATION,
            brand_name=brand_name,
            website_url=website_url,
            ad_library_url=ad_library_url,
            user_brief=user_brief,
            selected_strategy=selected_strategy
        )

        return JSONResponse(content=asset_results)

    except Exception as e:
        print(f"Error in /generate-assets-from-brief endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-social-copy")
async def generate_social_copy_endpoint(request: Request):
    try:
        data = await request.json()
        
        brand_name = data.get("brandName")
        user_brief = data.get("userBrief")
        selected_strategy = data.get("selectedStrategy")

        if not all([brand_name, user_brief, selected_strategy]):
            raise HTTPException(status_code=400, detail="Missing required data for copy generation.")

        # Call the Copywriter agent
        copy_results = copywriter_agent.generate_social_posts(
            project_id=PROJECT_ID,
            location=LOCATION,
            brand_name=brand_name,
            user_brief=user_brief,
            selected_strategy=selected_strategy
        )

        return JSONResponse(content=copy_results)

    except Exception as e:
        print(f"Error in /generate-social-copy endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
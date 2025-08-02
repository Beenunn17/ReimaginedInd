import vertexai
from vertexai.preview.vision_models import ImageGenerationModel, Image
import base64

PROMPT_ENHANCEMENTS = {
    "style": {
        "Photorealistic": "hyperrealistic, photorealistic, sharp focus, high detail",
        "3D Render": "3D render, octane render, cinematic lighting, Unreal Engine",
        "Film Photography": "shot on 35mm film, Kodak Portra 400, grainy, cinematic, subtle light leaks",
        "Minimalist": "minimalist aesthetic, clean lines, simple composition, negative space",
        "Cyberpunk": "cyberpunk style, neon lighting, futuristic cityscape, dystopian mood"
    },
    "camera": {
        "85mm": "shot on an 85mm f/1.4 lens, beautiful bokeh, shallow depth of field",
        "35mm": "shot on a 35mm lens, street photography style, wide-angle view",
        "Close-up": "extreme close-up shot, macro details",
        "Wide angle": "wide angle shot, expansive view",
        "Macro": "macro photography, intricate details"
    },
    "lighting": {
        "Studio Lighting": "professional studio lighting, softbox, three-point lighting",
        "Natural sunlight": "bright natural sunlight, soft shadows",
        "Golden hour": "golden hour lighting, warm tones, long shadows",
        "Moody / Low-key": "low-key lighting, dramatic shadows, moody atmosphere",
        "Backlit": "backlit subject, rim lighting, ethereal glow"
    },
    "composition": {
        "Centered": "symmetrical composition, subject centered in frame",
        "Rule of thirds": "composed using the rule of thirds",
        "Symmetrical": "perfectly symmetrical, balanced composition",
        "Flat lay": "flat lay composition, top-down view"
    },
    "modifiers": {
        "Ultra detailed": "ultra detailed, 8k resolution, sharp focus",
        "Cinematic": "cinematic shot, anamorphic lens flare, film grain",
        "Sharp focus": "tack-sharp focus, high clarity",
        "Soft focus": "soft focus, dreamy, ethereal quality",
        "Vintage": "vintage photo, faded colors, retro aesthetic"
    }
}

def _base64_to_image(base64_string: str) -> Image:
    """Converts a base64 data URL to a Vertex AI Image object."""
    image_data = base64.b64decode(base64_string.split(',')[1])
    return Image(image_data)

def generate_ad_creative(
    project_id: str,
    location: str,
    platform: str,
    prompt_components: dict,
    subject_image_b64: str | None = None,
    scene_image_b64: str | None = None
) -> dict | None:
    """Generates ad creative using Imagen from text and optional images."""
    vertexai.init(project=project_id, location=location)
    model = ImageGenerationModel.from_pretrained("imagen-4.0-ultra-generate-preview-06-06")

    subject_image = _base64_to_image(subject_image_b64) if subject_image_b64 else None
    negative_prompt = prompt_components.get('negativePrompt', '')
    
    try:
        image_urls = []
        for _ in range(4):
            generation_params = {
                "negative_prompt": negative_prompt,
                "number_of_images": 1
            }

            if subject_image:
                scene_details = f"A new background scene described as: {prompt_components.get('sceneDescription', 'a clean studio background')}."
                style_details = ", ".join(filter(None, [
                    PROMPT_ENHANCEMENTS["style"].get(prompt_components.get('style')),
                    PROMPT_ENHANCEMENTS["camera"].get(prompt_components.get('camera')),
                    PROMPT_ENHANCEMENTS["lighting"].get(prompt_components.get('lighting')),
                    PROMPT_ENHANCEMENTS["composition"].get(prompt_components.get('composition')),
                    PROMPT_ENHANCEMENTS["modifiers"].get(prompt_components.get('modifiers'))
                ]))
                final_prompt = f"Task: Image Composition. Isolate the subject from the base image and place it in a new scene: \"{scene_details}\". The final composite must have this style: {style_details}. The final image should be a {prompt_components.get('imageType', 'product photo')}."
                generation_params["prompt"] = final_prompt
                generation_params["base_image"] = subject_image
                response = model.edit_image(**generation_params)
            else:
                prompt_parts = [
                    prompt_components.get('imageType', 'Product Photo'), "of",
                    prompt_components.get('customSubject', 'a product'),
                    "in a scene described as:", prompt_components.get('sceneDescription', 'a clean studio background')
                ]
                for key in ['style', 'camera', 'lighting', 'composition', 'modifiers']:
                    enhanced_prompt = PROMPT_ENHANCEMENTS[key].get(prompt_components.get(key))
                    if enhanced_prompt:
                        prompt_parts.append(enhanced_prompt)
                final_prompt = ", ".join(prompt_parts)
                generation_params["prompt"] = final_prompt
                generation_params["aspect_ratio"] = "1:1" if platform.lower() == 'meta' else "9:16"
                response = model.generate_images(**generation_params)
            
            if response.images:
                for image in response.images:
                    image_bytes = image._image_bytes
                    encoded_string = base64.b64encode(image_bytes).decode('utf-8')
                    image_urls.append(f"data:image/png;base64,{encoded_string}")
        
        if image_urls:
            return {"image_urls": image_urls}
            
        return None
        
    except Exception as e:
        print(f"An error occurred during image generation: {str(e)}")
        return None
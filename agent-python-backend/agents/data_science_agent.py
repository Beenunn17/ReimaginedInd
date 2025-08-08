import pandas as pd
import io
import base64
import re
import json
import os
import vertexai
from vertexai.generative_models import GenerativeModel
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from lightweight_mmm.lightweight_mmm import LightweightMMM
from lightweight_mmm import plot
from lightweight_mmm import preprocessing
from lightweight_mmm import optimize_media

def get_df_schema(df: pd.DataFrame) -> str:
    # This function is correct and remains unchanged.
    pass

def run_standard_agent(dataframe: pd.DataFrame, user_prompt: str, project_id: str, location: str, model_name: str) -> dict:
    # This function is correct and remains unchanged.
    pass

def run_bayesian_mmm_agent(dataframe: pd.DataFrame, project_id: str, location: str, model_name: str, revenue_target: float) -> dict:
    """
    Runs a reproducible Bayesian MMM and generates a standardized dashboard.
    """
    vertexai.init(project=project_id, location=location)
    generative_model = GenerativeModel(model_name)

    try:
        data = dataframe.drop('Date', axis=1)
        target = data['Sales'].values
        media_spend = data.filter(like='_Spend').drop(['Competitor_Spend'], axis=1).values
        media_names = data.filter(like='_Spend').drop(['Competitor_Spend'], axis=1).columns.tolist()
        extra_features = data[['Competitor_Spend', 'Inflation_Index']].values
        costs = np.sum(media_spend, axis=0)

        print("Training Bayesian MMM with fixed seed for reproducibility...")
        mmm = LightweightMMM(model_name="carryover")
        
        mmm.fit(media=media_spend,
                extra_features=extra_features,
                media_prior=costs,
                target=target,
                number_warmup=1000,
                number_samples=1000,
                number_chains=1,
                seed=42)
        print("MMM Training Complete.")

        media_contribution, roi_hat = mmm.get_posterior_metrics()
        n_time_periods = 12
        
        solution = optimize_media.find_optimal_budgets(
            n_time_periods=n_time_periods,
            media_mix_model=mmm,
            budget=np.sum(costs) * (n_time_periods / len(target)),
            prices=np.mean(media_spend, axis=0)
        )
        
        interpretation_prompt = f"""
        You are a world-class marketing analytics consultant interpreting a standardized MMM dashboard.
        Your task is to translate the plots in the dashboard into a strategic JSON report.
        {{
          "reportTitle": "Bayesian MMM & Budget Optimization Dashboard",
          "keyInsights": [
              {{"insight": "Based on Media ROI, identify the top performing channel.", "metric": "State its approximate ROI."}},
              {{"insight": "Based on Response Curves, which channel shows the most potential for growth?", "metric": "N/A"}},
              {{"insight": "Based on Response Curves, which channel appears most saturated?", "metric": "N/A"}}
          ],
          "summary": "Write a strategic narrative explaining what the dashboard shows.",
          "recommendations": ["Based on the Optimal Budget Allocation, recommend specific budget shifts."]
        }}
        """
        response = generative_model.generate_content(interpretation_prompt)
        raw_text = response.text.strip()
        json_str_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not json_str_match:
            raise ValueError("The interpretation model did not return valid JSON object.")
        report_data = json.loads(json_str_match.group(0))

        # --- THIS IS THE ROBUST FIX FOR VISUALIZATION ---
        # Generate each plot individually and save it to an in-memory buffer
        
        plt.style.use('dark_background')

        # Plot 1: Media Contribution
        fig1 = plot.plot_media_baseline_contribution_area_plot(media_mix_model=mmm, channel_names=media_names, fig_size=(10, 6))
        fig1.suptitle("Media & Baseline Contribution")
        buf1 = io.BytesIO()
        fig1.savefig(buf1, format='png', bbox_inches='tight')
        buf1.seek(0)
        img1 = plt.imread(buf1)
        plt.close(fig1)

        # Plot 2: ROI
        fig2 = plot.plot_media_roi_hat(media_mix_model=mmm, total_costs=costs, channel_names=media_names, fig_size=(10, 6))
        fig2.suptitle("Return on Investment (ROI) by Channel")
        buf2 = io.BytesIO()
        fig2.savefig(buf2, format='png', bbox_inches='tight')
        buf2.seek(0)
        img2 = plt.imread(buf2)
        plt.close(fig2)

        # Plot 3: Response Curves
        fig3 = plot.plot_response_curves(media_mix_model=mmm, prices=np.mean(media_spend, axis=0), channel_names=media_names, fig_size=(10, 6))
        fig3.suptitle("Response Curves (mROI)")
        buf3 = io.BytesIO()
        fig3.savefig(buf3, format='png', bbox_inches='tight')
        buf3.seek(0)
        img3 = plt.imread(buf3)
        plt.close(fig3)

        # Plot 4: Optimal Budget (Manual Plot)
        fig4, ax4 = plt.subplots(figsize=(10, 6))
        ax4.bar(media_names, solution.x, color='skyblue')
        ax4.set_title(f"Optimal Budget Allocation (Next {n_time_periods} Weeks)")
        ax4.tick_params(axis='x', rotation=45, labelsize=8)
        fig4.suptitle("Optimal Budget Allocation")
        buf4 = io.BytesIO()
        fig4.savefig(buf4, format='png', bbox_inches='tight')
        buf4.seek(0)
        img4 = plt.imread(buf4)
        plt.close(fig4)

        # Combine the four plots into a single figure
        final_fig, final_axes = plt.subplots(2, 2, figsize=(20, 12))
        final_fig.suptitle('Standardized MMM Dashboard', fontsize=20)
        
        final_axes[0, 0].imshow(img1)
        final_axes[0, 0].axis('off')
        
        final_axes[0, 1].imshow(img2)
        final_axes[0, 1].axis('off')

        final_axes[1, 0].imshow(img3)
        final_axes[1, 0].axis('off')

        final_axes[1, 1].imshow(img4)
        final_axes[1, 1].axis('off')

        plt.tight_layout(rect=[0, 0.03, 1, 0.95])
        final_image_buffer = io.BytesIO()
        final_fig.savefig(final_image_buffer, format='PNG', bbox_inches='tight')
        plt.close(final_fig)

        image_b64 = base64.b64encode(final_image_buffer.getvalue()).decode()
        report_data["visualization"] = f"data:image/png;base64,{image_b64}"

        return report_data
    except Exception as e:
        return {"error": f"An error occurred during MMM analysis: {str(e)}"}


def run_follow_up_agent(dataframe: pd.DataFrame, original_prompt: str, follow_up_history_str: str, follow_up_prompt: str, project_id: str, location: str, model_name: str) -> dict:
    vertexai.init(project=project_id, location=location)
    generative_model = GenerativeModel(model_name)
    df_schema = get_df_schema(dataframe)
    prompt = f"""
    You are a data analytics consultant continuing a conversation.
    A pandas DataFrame `df` with schema {df_schema} is available.
    The original analysis was for the request: "{original_prompt}"
    The conversation history is: --- {follow_up_history_str} ---
    The user's new follow-up question is: "{follow_up_prompt}"
    Your task is to answer ONLY the newest follow-up question.
    Structure your output as a JSON object: {{"visualizationCode": "Python code for a new plot. Return '' if none.", "summary": "A text-based answer."}}
    Ensure the final output is ONLY the JSON object.
    """
    try:
        response = generative_model.generate_content(prompt)
        raw_text = response.text.strip()
        json_str_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not json_str_match: raise ValueError("Model did not return valid JSON.")
        report_data = json.loads(json_str_match.group(0))
        generated_code = report_data.get("visualizationCode", "").strip()
        if generated_code:
            image_buffer = io.BytesIO()
            local_vars = {'df': dataframe, 'plt': plt, 'np': np, 'pd': pd}
            exec(generated_code, globals(), local_vars)
            plt.savefig(image_buffer, format='PNG', bbox_inches='tight', transparent=True)
            plt.close()
            image_b64 = base64.b64encode(image_buffer.getvalue()).decode()
            report_data["visualization"] = f"data:image/png;base64,{image_b64}"
        return report_data
    except Exception as e:
        return {"error": str(e)}
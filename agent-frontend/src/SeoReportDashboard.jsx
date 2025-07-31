import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Accordion, AccordionSummary,
  AccordionDetails, ToggleButton, ToggleButtonGroup, List, ListItem,
  ListItemText, Divider, ListItemIcon
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InsightsIcon from '@mui/icons-material/Insights';

const QnaItem = ({ prompt, response }) => (
  <ListItem sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
    <ListItemText
      primary="PROMPT"
      secondary={prompt}
      primaryTypographyProps={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'text.secondary' }}
      secondaryTypographyProps={{ color: 'text.primary', fontStyle: 'italic', textTransform: 'none' }}
    />
    <ListItemText
      primary="RESPONSE"
      secondary={response}
      primaryTypographyProps={{ fontWeight: 'bold', fontSize: '0.8rem', mt: 1, color: 'primary.main' }}
      secondaryTypographyProps={{ color: 'text.primary', whiteSpace: 'pre-wrap', textTransform: 'none' }}
    />
  </ListItem>
);

function SeoReportDashboard({ report, originalPrompts }) {
  const [selectedLlm, setSelectedLlm] = useState('gemini');

  const handleLlmChange = (event, newLlm) => {
    if (newLlm !== null) {
      setSelectedLlm(newLlm);
    }
  };

  // FIX: Safely access LLM results with a fallback to an empty object
  const llmResults = report?.authorityAnalysis?.[selectedLlm] ?? {};

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" component="h3" gutterBottom>
        {report?.reportTitle ?? 'LLM Optimization Analysis'}
      </Typography>
      <Grid container spacing={4}>
        {/* Schema Audit Card */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Schema Audit</Typography>
            {/* FIX: Safely access score with a fallback */}
            <Chip label={`SCORE: ${report?.schemaAudit?.score ?? 0} / 100`} color="primary" sx={{ my: 1, px: 1 }} />
            <Typography variant="body2" sx={{ mt: 2, textTransform: 'none' }}>
              {/* FIX: Safely access summary with a fallback */}
              {report?.schemaAudit?.summary ?? 'No summary available.'}
            </Typography>
          </Paper>
        </Grid>

        {/* Authority Audit Card */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Authority Audit</Typography>
            <Chip label={`SCORE: ${report?.authorityAudit?.score ?? 0} / 100`} color="primary" sx={{ my: 1, px: 1 }} />
            
            <Typography variant="subtitle1" sx={{ mt: 2, display: 'flex', alignItems: 'center' }}><InsightsIcon sx={{mr:1}}/>Insights</Typography>
            <List dense>
              {(report?.authorityAudit?.insights ?? []).map((insight, index) => (
                <ListItem key={index} sx={{pl:0}}><ListItemText primary={insight} primaryTypographyProps={{textTransform: 'none'}}/></ListItem>
              ))}
            </List>

            <Typography variant="subtitle1" sx={{ mt: 2, display: 'flex', alignItems: 'center' }}><CheckCircleIcon color="success" sx={{mr:1}}/>Recommendations</Typography>
            <List dense>
              {(report?.authorityAudit?.recommendations ?? []).map((rec, index) => (
                 <ListItem key={index} sx={{pl:0}}><ListItemText primary={rec} primaryTypographyProps={{textTransform: 'none'}}/></ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Authority Analysis Drilldown */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Deep Dive</Typography>
              <ToggleButtonGroup value={selectedLlm} exclusive onChange={handleLlmChange} size="small">
                <ToggleButton value="gemini">Gemini</ToggleButton>
                <ToggleButton value="openai">OpenAI</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {Object.keys(llmResults).map((categoryKey) => (
              <Accordion key={categoryKey} sx={{ backgroundImage: 'none', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.23)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>{categoryKey.replace(/_/g, ' ')}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{p:0}}>
                  <List sx={{ width: '100%' }}>
                    {/* FIX: Safely access original prompts with a fallback */}
                    {(originalPrompts?.[categoryKey] ?? []).map((prompt, index) => (
                      <React.Fragment key={index}>
                         <QnaItem prompt={prompt} response={llmResults[categoryKey]?.[index] || "No response generated."} />
                        {index < (originalPrompts?.[categoryKey]?.length ?? 0) - 1 && <Divider sx={{ my: 2 }} />}
                      </React.Fragment>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SeoReportDashboard;
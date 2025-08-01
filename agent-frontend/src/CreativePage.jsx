import React, { useState } from 'react';
import { Button, TextField, Box, Typography, Paper, CircularProgress, Card, CardContent } from '@mui/material';

// DEFINE THE API BASE URL AT THE TOP
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';


function CreativePage() {
    const [prompt, setPrompt] = useState('');
    const [generatedContent, setGeneratedContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a prompt.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedContent('');

        try {
            const response = await fetch(`${API_BASE_URL}/generate-creative-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to generate content");
            }

            const data = await response.json();
            setGeneratedContent(data.creative_content);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>Creative Content Generator</Typography>
            <Paper sx={{ p: 2, mb: 3 }}>
                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Enter your creative prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    variant="outlined"
                    disabled={isLoading}
                />
                <Button
                    variant="contained"
                    onClick={handleGenerate}
                    disabled={isLoading}
                    sx={{ mt: 2 }}
                >
                    {isLoading ? <CircularProgress size={24} /> : "Generate"}
                </Button>
            </Paper>

            {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

            {generatedContent && (
                <Card>
                    <CardContent>
                        <Typography variant="h6">Generated Content:</Typography>
                        <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '10px', borderRadius: '4px', fontFamily: 'inherit', fontSize: '1rem' }}>
                            {generatedContent}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}

export default CreativePage;
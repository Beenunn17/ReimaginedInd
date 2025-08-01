import React, { useState, useEffect, useRef } from 'react';
import { Button, TextField, Box, Typography, Paper, CircularProgress, List, ListItem, ListItemText, Card, CardContent } from '@mui/material';

// DEFINE THE API AND WEBSOCKET BASE URLS
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

function SEOptimizerPage() {
    const [topic, setTopic] = useState('');
    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progressMessages, setProgressMessages] = useState([]);
    const ws = useRef(null);

    useEffect(() => {
        // WebSocket connection logic
        ws.current = new WebSocket(`${WS_BASE_URL}/ws/seo-analysis`);
        ws.current.onmessage = (event) => {
            setProgressMessages(prev => [...prev, event.data]);
        };
        ws.current.onopen = () => console.log("WebSocket connection established");
        ws.current.onerror = (err) => console.error("WebSocket Error:", err);
        ws.current.onclose = () => console.log("WebSocket connection closed");

        return () => {
            ws.current.close();
        };
    }, []);

    const handleStartAnalysis = async () => {
        if (!topic.trim()) {
            setError("Please enter a topic.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setReport(null);
        setProgressMessages([]);

        try {
            const response = await fetch(`${API_BASE_URL}/start-seo-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to start analysis");
            }

            const data = await response.json();
            setReport(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>SEO Content Optimizer</Typography>
            <Paper sx={{ p: 2, mb: 3 }}>
                <TextField
                    fullWidth
                    label="Enter a Topic or Keyword"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    variant="outlined"
                    disabled={isLoading}
                />
                <Button
                    variant="contained"
                    onClick={handleStartAnalysis}
                    disabled={isLoading}
                    sx={{ mt: 2 }}
                >
                    {isLoading ? <CircularProgress size={24} /> : "Generate SEO Report"}
                </Button>
            </Paper>

            {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

            {progressMessages.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6">Analysis Progress</Typography>
                        <List dense>
                            {progressMessages.map((msg, index) => (
                                <ListItem key={index}>
                                    <ListItemText primary={msg} />
                                </ListItem>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            )}

            {report && (
                <Card>
                    <CardContent>
                        <Typography variant="h5" gutterBottom>SEO Report for "{report.topic}"</Typography>
                        <Typography variant="h6" mt={2}>Keywords:</Typography>
                        <List>
                            {report.keywords.map((kw, i) => <ListItem key={i}><ListItemText primary={kw} /></ListItem>)}
                        </List>
                        <Typography variant="h6" mt={2}>Content Outline:</Typography>
                        <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                            {report.outline}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}

export default SEOptimizerPage;
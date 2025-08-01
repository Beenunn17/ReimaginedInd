import React, { useState } from 'react';
import { Button, Form, Input, Typography, Space, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';

const { Title } = Typography;
const { TextArea } = Input;

// Use the environment variable for the API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CreativePage = () => {
    const [form] = Form.useForm();
    const [creative, setCreative] = useState('');
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        setCreative('');
        const formData = new FormData();
        formData.append('product', values.product);
        formData.append('features', values.features);
        formData.append('prompt', values.prompt);

        try {
            // Construct the full URL using the base URL
            const response = await fetch(`${API_BASE_URL}/generate-creative`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setCreative(data.creative);
        } catch (error) {
            console.error('Failed to generate creative:', error);
            setCreative('Failed to generate creative. Please check the console for more details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '50px' }}>
            <Title level={2}>Generate Marketing Creative</Title>
            <Form form={form} layout="vertical" onFinish={onFinish}>
                <Form.Item
                    name="product"
                    label="Product Name"
                    rules={[{ required: true, message: 'Please input the product name!' }]}
                >
                    <Input placeholder="e.g., Braid" />
                </Form.Item>
                <Form.Item
                    name="features"
                    label="Product Features"
                    rules={[{ required: true, message: 'Please input the product features!' }]}
                >
                    <TextArea rows={4} placeholder="e.g., AI-powered, collaborative, secure" />
                </Form.Item>
                <Form.Item
                    name="prompt"
                    label="Prompt"
                    rules={[{ required: true, message: 'Please input your prompt!' }]}
                >
                    <TextArea rows={4} placeholder="e.g., Write a tweet about our new product" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={loading}>
                        Generate
                    </Button>
                </Form.Item>
            </Form>
            {loading && (
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <Spin size="large" />
                </div>
            )}
            {creative && (
                <div style={{ marginTop: '20px', padding: '20px', background: '#f0f2f5', borderRadius: '8px' }}>
                    <Title level={4}>Generated Creative:</Title>
                    <ReactMarkdown>{creative}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

export default CreativePage;

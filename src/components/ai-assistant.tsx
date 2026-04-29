"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sendChatMessage, isAIConfigured, ChatMessage } from '@/lib/ai';
import { Bot, Send, X, Loader2 } from 'lucide-react';

interface AIAssistantProps {
  initialPrompt?: string;
}

export function AIAssistant({ initialPrompt }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isAIConfigured();

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const response = await sendChatMessage([...messages, userMessage]);

    if (response.error) {
      setError(response.error);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!configured) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-full w-12 h-12 bg-gray-400"
          title="AI Assistant (Not Configured)"
        >
          <Bot className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-12 h-12 bg-blue-600 hover:bg-blue-700"
        >
          <Bot className="w-5 h-5" />
        </Button>
      ) : (
        <Card className="w-80 h-96 flex flex-col shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Assistant
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-3 mb-3">
              {messages.length === 0 && (
                <p className="text-xs text-gray-500 text-center mt-4">
                  Ask me anything about your fleet management system!
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded ${
                    msg.role === 'user'
                      ? 'bg-blue-100 ml-4'
                      : 'bg-gray-100 mr-4'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking...
                </div>
              )}
              {error && (
                <p className="text-xs text-red-500 p-2 bg-red-50 rounded">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="text-xs"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

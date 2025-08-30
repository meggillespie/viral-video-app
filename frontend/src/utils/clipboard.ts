// File: frontend/src/utils/clipboard.ts

export const handleCopy = async (
    textToCopy: string, 
    isFormatted: boolean = false, 
    setCopyStatus: (status: string) => void, 
    feedbackId: string = 'global'
) => {
    try {
        if (isFormatted) {
            // This logic mirrors the MarkdownRenderer to ensure what you see is what you copy.
            const html = textToCopy
                .replace(/^### (.*$)/gim, '<h3>$1</h3>') // Headings
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
                .replace(/(\r\n|\n|\r)/g, '<br>'); // Line breaks
            
            // A plain text version is also created as a fallback for apps that don't support rich text.
            const plainText = textToCopy
                .replace(/^### (.*$)/gim, '$1')
                .replace(/\*\*|\*/g, '');

            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobPlain = new Blob([plainText], { type: 'text/plain' });
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobPlain })]);
        } else {
            await navigator.clipboard.writeText(textToCopy);
        }
        setCopyStatus(feedbackId);
        setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
};
import mermaid from 'mermaid';

const theme = document.documentElement.dataset.theme === 'light' ? 'default' : 'dark';
mermaid.initialize({ startOnLoad: true, theme });

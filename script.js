document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const editor = document.getElementById('main-editor');
    const charCount = document.getElementById('char-count');
    const wordCount = document.getElementById('word-count');
    const dropZone = document.getElementById('drop-zone');
    const dropOverlay = document.getElementById('drop-overlay');
    const fileUpload = document.getElementById('file-upload');
    const btnUpload = document.getElementById('btn-upload');
    const btnCopy = document.getElementById('btn-copy');
    const btnPaste = document.getElementById('btn-paste');
    const btnClear = document.getElementById('btn-clear');
    const floatingMenu = document.getElementById('floating-menu');

    // Action Buttons
    const actionButtons = document.querySelectorAll('button[data-action]');

    // State
    const ignoreTitleWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'with', 'in', 'of'];

    // --- Core Conversion Logic ---

    const converters = {
        upper: (text) => text.toUpperCase(),
        lower: (text) => text.toLowerCase(),
        title: (text) => {
            return text.toLowerCase().replace(/\b\w+/g, (word, index) => {
                // Always capitalize first word or if it's not in ignore list
                if (index === 0 || !ignoreTitleWords.includes(word)) {
                    return word.charAt(0).toUpperCase() + word.slice(1);
                }
                return word;
            });
        },
        sentence: (text) => {
            // Lowercase everything first to normalize
            const lower = text.toLowerCase();
            // Regex matches: start of string OR sentence end punctuation followed by optional whitespace
            return lower.replace(/(^\s*\w|[\.\!\?]\s*\w)/g, (c) => c.toUpperCase());
        },
        capitalized: (text) => {
            // Simple Capitalize Every Word
            return text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        },
        alternating: (text) => {
            return text.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
        },
        inverse: (text) => {
            return text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
        }
    };

    // --- Event Listeners ---

    // Stats Update
    editor.addEventListener('input', updateStats);

    // Global Action Buttons
    actionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            if (action === 'download') {
                downloadText();
            } else {
                applyConversion(action);
            }
        });
    });

    // Toolbar Buttons
    btnCopy.addEventListener('click', copyToClipboard);
    btnPaste.addEventListener('click', pasteFromClipboard);
    btnClear.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the text?')) {
            editor.value = '';
            updateStats();
            editor.focus();
        }
    });

    // Upload Handling
    btnUpload.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', handleFileSelect);

    // API: Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropOverlay.classList.remove('hidden');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        // Only hide if we left the main container, not just entered a child
        if (!dropZone.contains(e.relatedTarget)) {
            dropOverlay.classList.add('hidden');
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('hidden');

        if (e.dataTransfer.files.length > 0) {
            readFile(e.dataTransfer.files[0]);
        }
    });

    // Floating Menu Logic
    editor.addEventListener('mouseup', handleSelection);
    editor.addEventListener('keyup', handleSelection); // For keyboard selection
    document.addEventListener('mousedown', (e) => {
        // Hide menu if clicking outside it
        if (!floatingMenu.contains(e.target) && e.target !== editor) {
            floatingMenu.classList.add('hidden');
        }
    });

    // --- Functions ---

    function updateStats() {
        const text = editor.value;
        charCount.textContent = `${text.length.toLocaleString()} Characters`;
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        wordCount.textContent = `${words.toLocaleString()} Words`;
    }

    function applyConversion(type) {
        if (!converters[type]) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const fullText = editor.value;

        // If selection exists, convert only selection
        if (start !== end) {
            const selectedText = fullText.substring(start, end);
            const convertedText = converters[type](selectedText);
            editor.setRangeText(convertedText, start, end, 'select');
        } else {
            // Convert everything
            editor.value = converters[type](fullText);
        }

        updateStats();
        // Keep focus on editor
        editor.focus();
        // Hide menu after action
        floatingMenu.classList.add('hidden');
    }

    function copyToClipboard() {
        editor.select();
        navigator.clipboard.writeText(editor.value).then(() => {
            const originalText = btnCopy.innerHTML;
            btnCopy.innerHTML = `<span style="color:var(--secondary)">Copied!</span>`;
            setTimeout(() => {
                btnCopy.innerHTML = originalText;
            }, 1500);
        });
    }

    async function pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.setRangeText(text, start, end, 'end');
            updateStats();
        } catch (err) {
            // Fallback for older browsers or permission denied
            editor.focus();
            document.execCommand('paste');
        }
    }

    function handleFileSelect(e) {
        if (e.target.files.length > 0) {
            readFile(e.target.files[0]);
        }
        e.target.value = '';
    }

    function readFile(file) {
        const reader = new FileReader();
        const isDocx = file.name.endsWith('.docx');

        reader.onload = (e) => {
            if (isDocx && window.mammoth) {
                const arrayBuffer = e.target.result;
                window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then((result) => {
                        editor.value = result.value;
                        updateStats();
                    })
                    .catch((err) => {
                        console.error(err);
                        alert('Error reading DOCX file.');
                    });
            } else {
                // Text fallbacks
                editor.value = e.target.result;
                updateStats();
            }
        };

        if (isDocx) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    }

    function downloadText() {
        const blob = new Blob([editor.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted-text.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleSelection(e) {
        // Debounce slightly to ensure selection is finalized
        setTimeout(() => {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;

            // Only show if there is a selection
            if (start === end) {
                floatingMenu.classList.add('hidden');
                return;
            }

            // If triggered by keyboard (keyup), 'e' might not be a mouse event
            if (e.type === 'keyup') {
                // For keyboard, we can't easily position near cursor without complex libs.
                // We'll skip showing floating menu for keyboard access to keep it clean, 
                // key users use shortcuts or the main buttons.
                return;
            }

            // Position at mouse coords
            const x = e.pageX;
            const y = e.pageY - 50; // 50px offset to be above cursor/selection

            floatingMenu.style.left = `${x}px`;
            floatingMenu.style.top = `${y}px`;
            floatingMenu.style.transform = 'translateX(-50%)';
            floatingMenu.classList.remove('hidden');
        }, 10);
    }
});

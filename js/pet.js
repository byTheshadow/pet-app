    // ── Chat Menu ─────────────────────────────────────────────────

    function showChatMenu() {
        if (!currentConvId) return;
        const conv = Store.getConversation(currentConvId);

        UI.showModal(`
            <h3>⛧ Chat Options</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <button class="gothic-btn full-width" id="btn-chat-bg">🖼️ Set Background Image</button>
                <button class="gothic-btn full-width" id="btn-chat-bubble">🎨 Custom Bubble CSS</button>
                <button class="gothic-btn full-width" id="btn-view-summary">📜 View Summary</button>
                <button class="gothic-btn full-width" id="btn-clear-chat">🗑️ Clear Messages</button>
                <button class="gothic-btn full-width" id="btn-delete-chat">☠️ Delete Conversation</button>
                <button class="gothic-btn" onclick="UI.closeModal()">Cancel</button>
            </div>
        `);

        document.getElementById('btn-chat-bg').addEventListener('click', () => {
            UI.closeModal();
            UI.showModal(`
                <h3>🖼️ Background Image</h3>
                <div class="setting-item">
                    <label>Image URL</label>
                    <input type="text" id="bg-url-input"
                        placeholder="https://..."
                        value="${UI.escapeHtml(conv.bgImage || '')}">
                </div>
                <div class="modal-btns">
                    <button class="gothic-btn" id="btn-clear-bg">Clear</button>
                    <button class="gothic-btn primary" id="btn-save-bg">Apply</button>
                </div>
            `);
            document.getElementById('btn-save-bg').addEventListener('click', () => {
                const url = document.getElementById('bg-url-input').value.trim();
                Store.updateConversation(currentConvId, { bgImage: url });
                const msgContainer = document.getElementById('chat-messages');
                if (url) {
                    msgContainer.style.backgroundImage = `url(${url})`;
                    msgContainer.style.backgroundSize = 'cover';
                    msgContainer.style.backgroundPosition = 'center';
                } else {
                    msgContainer.style.backgroundImage = '';
                }
                UI.closeModal();
                UI.toast('Background updated');
            });
            document.getElementById('btn-clear-bg').addEventListener('click', () => {
                Store.updateConversation(currentConvId, { bgImage: '' });
                document.getElementById('chat-messages').style.backgroundImage = '';
                UI.closeModal();
                UI.toast('Background cleared');
            });
        });

        document.getElementById('btn-chat-bubble').addEventListener('click', () => {
            UI.closeModal();
            UI.showModal(`
                <h3>🎨 Custom Bubble CSS</h3>
                <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
                    Target <code>.msg-row.self .msg-bubble</code> and <code>.msg-row.other .msg-bubble</code>
                </p>
                <div class="setting-item">
                    <textarea id="bubble-css-input" rows="6"
                        placeholder=".msg-row.self .msg-bubble { background: rgba(255,0,100,0.3); }"
                        style="font-family:monospace;font-size:12px;">${UI.escapeHtml(conv.bubbleCss || '')}</textarea>
                </div>
                <div class="modal-btns">
                    <button class="gothic-btn" id="btn-clear-bubble">Clear</button>
                    <button class="gothic-btn primary" id="btn-save-bubble">Apply</button>
                </div>
            `);
            document.getElementById('btn-save-bubble').addEventListener('click', () => {
                const css = document.getElementById('bubble-css-input').value;
                Store.updateConversation(currentConvId, { bubbleCss: css });
                document.getElementById('custom-bubble-style')?.remove();
                if (css) {
                    const style = document.createElement('style');
                    style.id = 'custom-bubble-style';
                    style.textContent = css;
                    document.head.appendChild(style);
                }
                UI.closeModal();
                UI.toast('Bubble style applied');
            });
            document.getElementById('btn-clear-bubble').addEventListener('click', () => {
                Store.updateConversation(currentConvId, { bubbleCss: '' });
                document.getElementById('custom-bubble-style')?.remove();
                UI.closeModal();
                UI.toast('Bubble style cleared');
            });
        });

        // ── View Summary（调用新版 modal）──
        document.getElementById('btn-view-summary').addEventListener('click', () => {
            UI.closeModal();
            showSummaryModal();
        });

        // ── Clear Messages ──
        document.getElementById('btn-clear-chat').addEventListener('click', () => {
            UI.closeModal();
            UI.showModal(`
                <h3>⚠️ Clear Messages</h3>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
                    This will delete all messages and summary in this conversation. This cannot be undone.
                </p>
                <div class="modal-btns">
                    <button class="gothic-btn" onclick="UI.closeModal()">Cancel</button>
                    <button class="gothic-btn danger" id="btn-confirm-clear">Clear All</button>
                </div>
            `);
            setTimeout(() => {
                document.getElementById('btn-confirm-clear').addEventListener('click', () => {
                    Store.saveMessages(currentConvId, []);
                    Store.saveSummary(currentConvId, '');
                    renderMessages();
                    UI.closeModal();
                    UI.toast('Messages cleared');
                });
            }, 50);
        });

        // ── Delete Conversation ──
        document.getElementById('btn-delete-chat').addEventListener('click', () => {
            UI.closeModal();
            UI.showModal(`
                <h3>☠️ Delete Conversation</h3>
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
                    This will permanently delete this conversation and all its messages. This cannot be undone.
                </p>
                <div class="modal-btns">
                    <button class="gothic-btn" onclick="UI.closeModal()">Cancel</button>
                    <button class="gothic-btn danger" id="btn-confirm-delete">Delete</button>
                </div>
            `);
            setTimeout(() => {
                document.getElementById('btn-confirm-delete').addEventListener('click', () => {
                    Store.deleteConversation(currentConvId);
                    currentConvId = null;
                    UI.closeModal();
                    renderContactList();
                    App.navigateTo('chat-list');
                    UI.toast('Conversation deleted');
                });
            }, 50);
        });
    }



(function () {
    'use strict';

    if (window.__libraryAuthInit) return;
    window.__libraryAuthInit = true;

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    onReady(function () {
        const ACTIVE_TAB_KEY = 'library.activeTab';
        const PASSWORD_RULE_MESSAGE = 'Пароль должен содержать минимум 8 символов: a-z, A-Z, цифры 0-9 или другие символы.';
        const PASSWORD_MATCHES_USERNAME_MESSAGE = 'Имя и пароль не должны совпадать.';

        const $ = function (id) { return document.getElementById(id); };

        const tabLogin = $('tabLogin');
        const tabRegister = $('tabRegister');
        const loginForm = $('loginForm');
        const registerForm = $('registerForm');
        const authContainer = document.querySelector('.auth-container');

        if (!tabLogin || !tabRegister || !loginForm || !registerForm || !authContainer) return;

        const loginUsernameInput = $('loginUsername');
        const loginPasswordInput = $('loginPassword');
        const loginEmptyError = $('loginEmptyError');
        const toggleLoginPassword = $('toggleLoginPassword');
        const iconEyeLogin = $('icon-eye-login');
        const iconEyeOffLogin = $('icon-eye-off-login');

        const regUsernameInput = $('regUsername');
        const regPasswordInput = $('regPassword');
        const regPasswordConfirmInput = $('regPasswordConfirm');
        const toggleRegPassword = $('toggleRegPassword');
        const toggleRegPasswordConfirm = $('toggleRegPasswordConfirm');
        const iconEyeReg = $('icon-eye-reg');
        const iconEyeOffReg = $('icon-eye-off-reg');
        const iconEyeConfirm = $('icon-eye-confirm');
        const iconEyeOffConfirm = $('icon-eye-off-confirm');
        const registerSubmitBtn = $('registerSubmitBtn');
        const passwordRuleError = $('passwordRuleError');
        const passwordMismatchError = $('passwordMismatchError');
        const loginRuleError = $('loginRuleError');
        const regPasswordLabel = document.querySelector('label[for="regPassword"]');
        const regPasswordConfirmLabel = document.querySelector('label[for="regPasswordConfirm"]');

        // ===== Капча регистрации: DOM =====
        const captchaModal = $('captchaModal');
        const captchaTextEl = $('captchaText');
        const captchaInput = $('captchaInput');
        const captchaError = $('captchaError');
        const captchaSubmit = $('captchaSubmit');
        const captchaMirror = $('captchaMirror');

        // ===== Капча входа: DOM =====
        const loginCaptchaModal = $('loginCaptchaModal');
        const loginCaptchaTextEl = $('loginCaptchaText');
        const loginCaptchaInput = $('loginCaptchaInput');
        const loginCaptchaError = $('loginCaptchaError');
        const loginCaptchaSubmit = $('loginCaptchaSubmit');
        const loginCaptchaMirror = $('loginCaptchaMirror');

        let isLoginValid = false;
        let isPasswordValid = false;
        let isConfirmValid = false;
        let confirmWasEmpty = true;
        let savedPasswordVisible = false;
        let savedConfirmVisible = false;
        let authBusy = false;

        // ===== Стартовые анимации =====
        authContainer.classList.add('slide-in');
        authContainer.addEventListener('animationend', function (e) {
            if (e.target === authContainer) {
                authContainer.classList.remove('slide-in');
            }
        });

        function saveActiveTab(tab) {
            try {
                sessionStorage.setItem(ACTIVE_TAB_KEY, tab);
            } catch (e) {
                // приватный режим и т.п.
            }
        }

        function updateFilledClass(input) {
            input.classList.toggle('filled', input.value.length > 0);
        }

        function setHidden(el, hidden) {
            el.classList.toggle('hidden', hidden);
        }

        function setFieldError(input, hasError) {
            input.classList.toggle('error-border', hasError);
        }

        function setFieldSuccess(input, isValid) {
            input.classList.toggle('success', isValid);
        }

        function setToggleShown(toggle, shown) {
            toggle.classList.toggle('hidden', !shown);
            toggle.classList.toggle('visible', shown);
        }

        function setPasswordFieldVisibility(input, toggle, iconOn, iconOff, isVisible) {
            input.setAttribute('type', isVisible ? 'text' : 'password');
            toggle.classList.toggle('show', isVisible);
            iconOn.classList.toggle('hidden', isVisible);
            iconOff.classList.toggle('hidden', !isVisible);
            toggle.setAttribute('aria-label', isVisible ? 'Скрыть пароль' : 'Показать пароль');
        }

        function restoreCaret(input, start, end) {
            setTimeout(function () {
                input.focus();
                try {
                    input.setSelectionRange(start, end);
                } catch (e) {
                    // некоторые браузеры не дают caret на type=password
                }
            }, 0);
        }

        function caretForToggle(input) {
            if (document.activeElement === input) {
                return {
                    start: input.selectionStart,
                    end: input.selectionEnd
                };
            }
            const len = input.value.length;
            return { start: len, end: len };
        }

        function maxLengthOf(input) {
            const max = input.maxLength;
            return max && max > 0 ? max : Infinity;
        }

        function insertSanitized(input, rawText) {
            const cleaned = String(rawText || '').replace(/\s+/g, '');
            let start = input.selectionStart;
            let end = input.selectionEnd;
            if (start === null || start === undefined) start = input.value.length;
            if (end === null || end === undefined) end = input.value.length;

            const budget = Math.max(0, maxLengthOf(input) - (input.value.length - (end - start)));
            const chunk = cleaned.slice(0, budget);
            input.value = input.value.slice(0, start) + chunk + input.value.slice(end);

            const pos = start + chunk.length;
            try {
                input.setSelectionRange(pos, pos);
            } catch (err) {
                // игнорируем
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        function stripSpacesFromInput(input) {
            if (!input || typeof input.value !== 'string') return;
            if (!/\s/.test(input.value)) return;

            const originalValue = input.value;
            let cursorPos = input.selectionStart;
            if (cursorPos === null || cursorPos === undefined) {
                cursorPos = originalValue.length;
            }

            const spacesBeforeCursor = (originalValue.slice(0, cursorPos).match(/\s/g) || []).length;
            input.value = originalValue.replace(/\s/g, '');

            const newPos = Math.max(0, cursorPos - spacesBeforeCursor);
            try {
                input.setSelectionRange(newPos, newPos);
            } catch (err) {
                // игнорируем
            }
        }

        function isFieldLocked(input) {
            return input.readOnly || input.classList.contains('disabled-input');
        }

        function setFieldLocked(input, label, locked) {
            const wasLocked = input.readOnly;
            if (locked) {
                input.readOnly = true;
                input.tabIndex = -1;
                input.setAttribute('aria-disabled', 'true');
                input.classList.add('disabled-input');
                if (label) label.classList.add('disabled-label');
                if (document.activeElement === input) {
                    input.blur();
                }
            } else {
                input.readOnly = false;
                input.removeAttribute('tabindex');
                input.setAttribute('aria-disabled', 'false');
                input.classList.remove('disabled-input');
                if (label) label.classList.remove('disabled-label');
            }
            return wasLocked;
        }

        function isSpaceKey(e) {
            return e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32;
        }

        function playButtonAnimation(button, callback) {
            if (!button) {
                if (typeof callback === 'function') callback();
                return;
            }
            if (button.classList.contains('btn-loading')) return;

            authBusy = true;
            const wasDisabled = button.disabled;
            button.classList.add('btn-loading');
            button.disabled = true;

            const dots = document.createElement('span');
            dots.className = 'btn-dots';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('span');
                dot.className = 'btn-dot';
                dots.appendChild(dot);
            }
            button.appendChild(dots);

            const REVEAL_AT = 550;
            const CLEANUP_AT = 950;

            setTimeout(function () {
                if (typeof callback === 'function') callback();

                setTimeout(function () {
                    button.classList.remove('btn-loading');
                    if (dots.parentNode === button) {
                        button.removeChild(dots);
                    }
                    button.disabled = wasDisabled;
                    if (!document.body.classList.contains('captcha-open')) {
                        authBusy = false;
                    }
                }, CLEANUP_AT - REVEAL_AT);
            }, REVEAL_AT);
        }

        // Полный запрет пробелов: клавиатура, вставка, drag&drop, IME.
        function bindNoSpaces(input) {
            input.addEventListener('keydown', function (e) {
                if (isSpaceKey(e)) {
                    e.preventDefault();
                }
            });

            input.addEventListener('beforeinput', function (e) {
                if (isFieldLocked(input)) {
                    e.preventDefault();
                    return;
                }
                if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
                    e.preventDefault();
                    return;
                }
                if (e.data && /\s/.test(e.data)) {
                    e.preventDefault();
                    const cleaned = e.data.replace(/\s+/g, '');
                    if (cleaned) insertSanitized(input, cleaned);
                }
            });

            input.addEventListener('paste', function (e) {
                e.preventDefault();
                if (isFieldLocked(input)) return;
                const clipboardData = e.clipboardData || window.clipboardData;
                let pastedText = '';
                try {
                    if (clipboardData && typeof clipboardData.getData === 'function') {
                        pastedText = clipboardData.getData('text') || clipboardData.getData('text/plain') || '';
                    }
                } catch (err) {
                    pastedText = '';
                }
                insertSanitized(input, pastedText);
            });

            input.addEventListener('drop', function (e) {
                e.preventDefault();
                if (isFieldLocked(input)) return;
                let text = '';
                try {
                    text = (e.dataTransfer && e.dataTransfer.getData('text')) || '';
                } catch (err) {
                    text = '';
                }
                insertSanitized(input, text);
            });

            input.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (isFieldLocked(input)) {
                    e.dataTransfer && (e.dataTransfer.dropEffect = 'none');
                }
            });

            input.addEventListener('input', function () {
                stripSpacesFromInput(input);
            });

            input.addEventListener('compositionend', function () {
                stripSpacesFromInput(input);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }

        // Фильтрация пробелов только при ВСТАВКЕ и drag&drop.
        // С клавиатуры пробел вводится как обычный символ.
        function bindPasteSanitize(input) {
            input.addEventListener('beforeinput', function (e) {
                if (isFieldLocked(input)) {
                    e.preventDefault();
                    return;
                }
                if (e.inputType === 'insertFromPaste' ||
                    e.inputType === 'insertFromPasteAsQuotation' ||
                    e.inputType === 'insertFromDrop' ||
                    e.inputType === 'insertFromYank') {
                    e.preventDefault();
                }
            });

            input.addEventListener('paste', function (e) {
                e.preventDefault();
                if (isFieldLocked(input)) return;
                const clipboardData = e.clipboardData || window.clipboardData;
                let pastedText = '';
                try {
                    if (clipboardData && typeof clipboardData.getData === 'function') {
                        pastedText = clipboardData.getData('text') || clipboardData.getData('text/plain') || '';
                    }
                } catch (err) {
                    pastedText = '';
                }
                insertSanitized(input, pastedText);
            });

            input.addEventListener('drop', function (e) {
                e.preventDefault();
                if (isFieldLocked(input)) return;
                let text = '';
                try {
                    text = (e.dataTransfer && e.dataTransfer.getData('text')) || '';
                } catch (err) {
                    text = '';
                }
                insertSanitized(input, text);
            });

            input.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (isFieldLocked(input)) {
                    e.dataTransfer && (e.dataTransfer.dropEffect = 'none');
                }
            });
        }

        function bindCaptchaInput(input) {
            const ALLOWED_CHAR = /^[a-zA-Z0-9]$/;
            const ALLOWED_GLOBAL = /[^a-zA-Z0-9]/g;

            function forceCaretToEnd() {
                const len = input.value.length;
                try {
                    input.setSelectionRange(len, len);
                } catch (e) {
                    // игнорируем
                }
            }

            input.addEventListener('selectstart', function (e) {
                e.preventDefault();
            });

            input.addEventListener('mousedown', function (e) {
                e.preventDefault();
                input.focus();
                forceCaretToEnd();
            });

            input.addEventListener('keydown', function (e) {
                if ((e.ctrlKey || e.metaKey) &&
                    (e.key === 'a' || e.key === 'A' ||
                     e.key === 'c' || e.key === 'C' ||
                     e.key === 'x' || e.key === 'X')) {
                    e.preventDefault();
                    return;
                }

                if (e.shiftKey &&
                    (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                     e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                     e.key === 'Home' || e.key === 'End')) {
                    e.preventDefault();
                    forceCaretToEnd();
                    return;
                }

                if (!e.ctrlKey && !e.metaKey) {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                        e.key === 'Home' || e.key === 'End') {
                        e.preventDefault();
                        forceCaretToEnd();
                        return;
                    }
                }

                if (isSpaceKey(e)) {
                    e.preventDefault();
                    return;
                }

                if (e.key.length !== 1) return;
                if (e.ctrlKey || e.metaKey) return;
                if (!ALLOWED_CHAR.test(e.key)) {
                    e.preventDefault();
                }
            });

            input.addEventListener('beforeinput', function (e) {
                if (e.inputType === 'insertFromPaste' ||
                    e.inputType === 'insertFromPasteAsQuotation' ||
                    e.inputType === 'insertFromDrop' ||
                    e.inputType === 'insertFromYank') {
                    e.preventDefault();
                    return;
                }
                if (e.data) {
                    const cleaned = e.data.replace(ALLOWED_GLOBAL, '');
                    if (cleaned !== e.data) {
                        e.preventDefault();
                        if (cleaned) insertSanitized(input, cleaned);
                    }
                }
            });

            input.addEventListener('paste', function (e) {
                e.preventDefault();
            });

            input.addEventListener('drop', function (e) {
                e.preventDefault();
            });

            input.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
            });

            input.addEventListener('input', function () {
                if (/[^a-zA-Z0-9]/.test(input.value)) {
                    const originalValue = input.value;
                    let cursorPos = input.selectionStart;
                    if (cursorPos === null || cursorPos === undefined) {
                        cursorPos = originalValue.length;
                    }
                    const badBeforeCursor = (originalValue.slice(0, cursorPos).match(/[^a-zA-Z0-9]/g) || []).length;
                    input.value = originalValue.replace(ALLOWED_GLOBAL, '');
                    const newPos = Math.max(0, cursorPos - badBeforeCursor);
                    try {
                        input.setSelectionRange(newPos, newPos);
                    } catch (err) {
                        // игнорируем
                    }
                }
                forceCaretToEnd();
            });

            input.addEventListener('compositionend', function () {
                if (/[^a-zA-Z0-9]/.test(input.value)) {
                    input.value = input.value.replace(ALLOWED_GLOBAL, '');
                }
                input.dispatchEvent(new Event('input', { bubbles: true }));
                forceCaretToEnd();
            });

            input.addEventListener('contextmenu', function (e) {
                e.preventDefault();
            });

            input.addEventListener('focus', function () {
                forceCaretToEnd();
            });

            input.addEventListener('mouseup', function () {
                setTimeout(forceCaretToEnd, 0);
            });

            input.addEventListener('select', function () {
                forceCaretToEnd();
            });

            document.addEventListener('selectionchange', function () {
                if (document.activeElement === input) {
                    forceCaretToEnd();
                }
            });
        }

        function generateCaptcha() {
            const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const digits = '0123456789';

            const usedLettersLower = new Set();
            const chosenLetters = [];
            while (chosenLetters.length < 3) {
                const ch = letters.charAt(Math.floor(Math.random() * letters.length));
                const lower = ch.toLowerCase();
                if (usedLettersLower.has(lower)) continue;
                usedLettersLower.add(lower);
                chosenLetters.push(ch);
            }

            const usedDigits = new Set();
            while (usedDigits.size < 3) {
                const ch = digits.charAt(Math.floor(Math.random() * digits.length));
                usedDigits.add(ch);
            }

            const chars = chosenLetters.concat(Array.from(usedDigits));

            for (let i = chars.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = chars[i];
                chars[i] = chars[j];
                chars[j] = tmp;
            }

            return chars.join('');
        }

        function createCaptchaController(opts) {
            const modal = opts.modal;
            const textEl = opts.textEl;
            const input = opts.input;
            const errorEl = opts.errorEl;
            const submitBtn = opts.submitBtn;
            const mirror = opts.mirror;
            const onSuccess = opts.onSuccess;

            if (!modal || !textEl || !input || !errorEl || !submitBtn || !mirror) {
                return {
                    input: null,
                    cells: [],
                    isModalOpen: function () { return false; },
                    isCaptchaSuccess: function () { return false; },
                    canClose: function () { return false; },
                    check: function () {},
                    show: function () {},
                    hide: function () {},
                    align: function () {}
                };
            }

            const win = modal.querySelector('.modal-window');
            const cells = Array.from(mirror.querySelectorAll('.captcha-cell'));

            cells.forEach(function (cell) {
                if (!cell.querySelector('.glyph')) {
                    const text = cell.textContent || '_';
                    cell.textContent = '';
                    const glyph = document.createElement('span');
                    glyph.className = 'glyph';
                    glyph.textContent = text;
                    cell.appendChild(glyph);
                }
            });

            if (win && !win.querySelector('.modal-success')) {
                const successEl = document.createElement('div');
                successEl.className = 'modal-success';

                const successText = 'Успешно!';
                let textHTML = '';
                for (let i = 0; i < successText.length; i++) {
                    const delayMs = i * 55;
                    const ch = successText.charAt(i)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    textHTML += '<span class="success-char" style="transition-delay:' + delayMs + 'ms">' + ch + '</span>';
                }

                successEl.innerHTML =
                    '<svg class="modal-success-icon" viewBox="0 0 40 40" aria-hidden="true">' +
                        '<path d="M6 21 L16 31 L34 9"></path>' +
                    '</svg>' +
                    '<span class="modal-success-text">' + textHTML + '</span>';

                win.appendChild(successEl);
            }

            let currentCaptcha = '';
            let inErrorState = false;
            let errorKind = '';
            let successLock = false;

            function renderText(text) {
                textEl.textContent = '';
                for (let i = 0; i < text.length; i++) {
                    const span = document.createElement('span');
                    span.className = 'captcha-char';
                    span.textContent = text.charAt(i);
                    textEl.appendChild(span);
                }
            }

            function updateMirror() {
                const value = input.value;

                const isFull = value.length >= cells.length;
                const isMatch = isFull && value.toLowerCase() === currentCaptcha.toLowerCase();

                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i];
                    const glyph = cell.querySelector('.glyph');
                    const ch = value.charAt(i) || '_';

                    if (glyph) {
                        glyph.textContent = ch;
                    } else {
                        cell.textContent = ch;
                    }

                    cell.classList.remove('active');

                    if (isFull && !isMatch && ch !== '_') {
                        cell.classList.add('invalid');
                    } else {
                        cell.classList.remove('invalid');
                    }
                }

                submitBtn.disabled = !isFull;

                if (isFull && isMatch) {
                    inErrorState = false;
                    errorKind = '';
                    setHidden(errorEl, true);
                    input.classList.add('success');
                    input.classList.remove('error-border');
                } else if (isFull && !isMatch) {
                    if (errorKind === 'incomplete') {
                        inErrorState = false;
                        errorKind = '';
                        setHidden(errorEl, true);
                    }
                    input.classList.add('error-border');
                    input.classList.remove('success');
                } else if (inErrorState) {
                    input.classList.add('error-border');
                    input.classList.remove('success');
                } else {
                    input.classList.remove('success', 'error-border');
                }

                if (isFull) return;

                const pos = value.length;
                if (cells[pos]) cells[pos].classList.add('active');
            }

            function align() {
                if (!cells.length || !cells[0] || modal.classList.contains('hidden')) return;
                const inputRect = input.getBoundingClientRect();
                const cellRect = cells[0].getBoundingClientRect();
                if (!cellRect.width) return;
                const inputStyle = getComputedStyle(input);
                const borderLeft = parseFloat(inputStyle.borderLeftWidth) || 0;
                const offset = cellRect.left - inputRect.left - borderLeft;
                input.style.paddingLeft = Math.max(0, offset) + 'px';
            }

            function lockInput() {
                try { input.blur(); } catch (e) {}
                input.readOnly = true;
                input.setAttribute('tabindex', '-1');
                input.style.pointerEvents = 'none';
                input.classList.remove('success', 'error-border');
                modal.classList.add('captcha-locked');
            }

            function unlockInput() {
                input.readOnly = false;
                input.removeAttribute('tabindex');
                input.style.pointerEvents = '';
                modal.classList.remove('captcha-locked');
            }

            function show() {
                currentCaptcha = generateCaptcha();
                renderText(currentCaptcha);
                input.value = '';
                input.classList.remove('error-border', 'success');
                inErrorState = false;
                errorKind = '';
                successLock = false;
                unlockInput();
                setHidden(errorEl, true);
                updateMirror();
                modal.classList.remove('hidden');

                document.body.classList.add('captcha-open');
                authContainer.classList.add('captcha-active');

                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        align();
                        input.focus();
                        updateMirror();
                    });
                });
            }

            function hide() {
                try { input.blur(); } catch (e) {}
                modal.classList.add('hidden');
                input.value = '';
                input.classList.remove('error-border', 'success');
                inErrorState = false;
                errorKind = '';
                successLock = false;
                unlockInput();
                setHidden(errorEl, true);
                updateMirror();
                currentCaptcha = '';

                if (win) win.classList.remove('captcha-success');

                document.body.classList.remove('captcha-open');
                authContainer.classList.remove('captcha-active');
                authBusy = false;
            }

            function showSuccess() {
                if (!win) {
                    hide();
                    if (typeof onSuccess === 'function') onSuccess();
                    return;
                }

                win.classList.add('captcha-success');

                const HOLD_MS = 1200;

                setTimeout(function () {
                    hide();
                    if (typeof onSuccess === 'function') onSuccess();

                    setTimeout(function () {
                        if (document.activeElement && document.activeElement.blur) {
                            document.activeElement.blur();
                        }
                    }, 0);
                }, HOLD_MS);
            }

            function check() {
                if (submitBtn.classList.contains('btn-loading')) return;

                if (win && win.classList.contains('captcha-success')) {
                    return;
                }

                const entered = input.value.trim();

                if (entered.length < cells.length) {
                    inErrorState = true;
                    errorKind = 'incomplete';
                    errorEl.textContent = 'Заполните поле до конца.';
                    setHidden(errorEl, false);
                    input.classList.add('error-border');
                    input.classList.remove('success');
                    updateMirror();
                    return;
                }

                if (entered.toLowerCase() === currentCaptcha.toLowerCase()) {
                    inErrorState = false;
                    errorKind = '';
                    successLock = true;
                    lockInput();
                    playButtonAnimation(submitBtn, function () {
                        showSuccess();
                    });
                    return;
                }

                currentCaptcha = generateCaptcha();
                renderText(currentCaptcha);
                input.value = '';
                updateMirror();

                inErrorState = true;
                errorKind = 'invalid';
                input.classList.add('error-border');
                input.classList.remove('success');
                errorEl.textContent = 'Неверный код. Попробуйте ещё раз.';
                setHidden(errorEl, false);
                input.focus();
            }

            function isModalOpen() {
                return !modal.classList.contains('hidden');
            }

            function isCaptchaSuccess() {
                return !!(win && win.classList.contains('captcha-success'));
            }

            function canClose() {
                return !successLock && !isCaptchaSuccess();
            }

            bindCaptchaInput(input);

            const closeBtn = win ? win.querySelector('.modal-close') : null;
            if (closeBtn) {
                closeBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (!canClose()) return;
                    hide();
                    hideAllVisiblePasswords();
                });
            }

            submitBtn.addEventListener('click', check);

            input.addEventListener('input', updateMirror);
            input.addEventListener('keyup', updateMirror);
            input.addEventListener('click', updateMirror);
            input.addEventListener('select', updateMirror);
            input.addEventListener('focus', updateMirror);

            input.addEventListener('blur', function () {
                for (let i = 0; i < cells.length; i++) {
                    cells[i].classList.remove('active');
                    cells[i].classList.remove('invalid');
                }
            });

            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    check();
                }
            });

            return {
                input: input,
                cells: cells,
                isModalOpen: isModalOpen,
                isCaptchaSuccess: isCaptchaSuccess,
                canClose: canClose,
                check: check,
                show: show,
                hide: hide,
                align: align
            };
        }

        function clearLoginForm() {
            loginUsernameInput.value = '';
            loginPasswordInput.value = '';
            updateFilledClass(loginUsernameInput);
            updateFilledClass(loginPasswordInput);
            setHidden(loginEmptyError, true);
            setLoginPasswordVisibility(false);
            updateLoginToggleVisibility();
        }

        const regCaptchaCtrl = createCaptchaController({
            modal: captchaModal,
            textEl: captchaTextEl,
            input: captchaInput,
            errorEl: captchaError,
            submitBtn: captchaSubmit,
            mirror: captchaMirror,
            onSuccess: function () {
                clearAllForms();
            }
        });

        const loginCaptchaCtrl = createCaptchaController({
            modal: loginCaptchaModal,
            textEl: loginCaptchaTextEl,
            input: loginCaptchaInput,
            errorEl: loginCaptchaError,
            submitBtn: loginCaptchaSubmit,
            mirror: loginCaptchaMirror,
            onSuccess: function () {
                clearLoginForm();
            }
        });

        function validateLogin(value) {
            if (/[а-яА-ЯёЁ]/.test(value)) {
                return { valid: false, message: 'Имя может содержать только латинские буквы.' };
            }
            if (/[^a-zA-Z0-9_]/.test(value)) {
                return { valid: false, message: 'Имя содержит недопустимые символы.' };
            }
            if (!/^[a-zA-Z]/.test(value)) {
                return { valid: false, message: 'Имя может начинаться только латинскими буквами.' };
            }
            if (value.length < 3 || value.length > 20) {
                return { valid: false, message: 'Имя должно содержать: от 3 до 20 символов.' };
            }
            if (value.charAt(value.length - 1) === '_') {
                return { valid: false, message: 'Имя не может содержать в конце символ: "_".' };
            }
            if ((value.match(/_/g) || []).length > 1) {
                return { valid: false, message: 'Имя может содержать только один символ "_".' };
            }
            if (/[0-9]{7,}/.test(value)) {
                return { valid: false, message: 'Недопустимое имя пользователя.' };
            }
            return { valid: true, message: '' };
        }

        function isPasswordValidFunc(value) {
            const forbidden = /[\sа-яА-ЯёЁ]/;
            const hasLatinLetter = /[a-zA-Z]/.test(value);
            const allSameChar = value.length > 0 && new Set(value).size === 1;
            return value.length >= 8 && !forbidden.test(value) && hasLatinLetter && !allSameChar;
        }

        function isPasswordMatchingUsername(value) {
            const username = regUsernameInput.value.trim();
            if (!username.length || !value.length) return false;
            return value.toLowerCase() === username.toLowerCase();
        }

        function isLoginEmpty() {
            return regUsernameInput.value.trim() === '';
        }

        function updateRegisterButtonState() {
            const isReady = isLoginValid && isPasswordValid && isConfirmValid;
            registerSubmitBtn.classList.toggle('disabled-btn', !isReady);
            registerSubmitBtn.setAttribute('aria-disabled', isReady ? 'false' : 'true');
        }

        function syncUsernameBorder() {
            const value = regUsernameInput.value;
            if (value.length === 0) {
                setFieldError(regUsernameInput, false);
                setFieldSuccess(regUsernameInput, false);
            } else if (isLoginValid) {
                setFieldError(regUsernameInput, false);
                setFieldSuccess(regUsernameInput, true);
            } else {
                setFieldError(regUsernameInput, true);
                setFieldSuccess(regUsernameInput, false);
            }
        }

        function forceUsernameError() {
            setFieldError(regUsernameInput, true);
            setFieldSuccess(regUsernameInput, false);
        }

        function resetRegToggle() {
            setPasswordFieldVisibility(regPasswordInput, toggleRegPassword, iconEyeReg, iconEyeOffReg, false);
            setPasswordFieldVisibility(regPasswordConfirmInput, toggleRegPasswordConfirm, iconEyeConfirm, iconEyeOffConfirm, false);
        }

        function updateRegToggleVisibility(input) {
            const toggle = input === regPasswordInput ? toggleRegPassword : toggleRegPasswordConfirm;
            const shown = !isFieldLocked(input) && input.value.length > 0;
            setToggleShown(toggle, shown);
        }

        function updateAllRegTogglesVisibility() {
            updateRegToggleVisibility(regPasswordInput);
            updateRegToggleVisibility(regPasswordConfirmInput);
        }

        function updateFieldAvailability() {
            const passwordShouldBeDisabled = !isLoginValid;
            const wasPasswordDisabled = regPasswordInput.readOnly || regPasswordInput.classList.contains('disabled-input');
            const wasConfirmDisabled = regPasswordConfirmInput.readOnly || regPasswordConfirmInput.classList.contains('disabled-input');

            if (passwordShouldBeDisabled) {
                if (!wasPasswordDisabled) {
                    savedPasswordVisible = regPasswordInput.getAttribute('type') === 'text';
                }
                setFieldLocked(regPasswordInput, regPasswordLabel, true);
                setPasswordFieldVisibility(regPasswordInput, toggleRegPassword, iconEyeReg, iconEyeOffReg, false);
                regPasswordInput.classList.remove('success');
                setFieldError(regPasswordInput, false);
                setHidden(passwordRuleError, true);
            } else {
                const wasLocked = setFieldLocked(regPasswordInput, regPasswordLabel, false);
                if (wasLocked && regPasswordInput.value.length > 0) {
                    setPasswordFieldVisibility(regPasswordInput, toggleRegPassword, iconEyeReg, iconEyeOffReg, savedPasswordVisible);
                }
            }

            const confirmShouldBeDisabled = passwordShouldBeDisabled || !isPasswordValid;

            if (confirmShouldBeDisabled) {
                if (!wasConfirmDisabled) {
                    savedConfirmVisible = regPasswordConfirmInput.getAttribute('type') === 'text';
                }
                setFieldLocked(regPasswordConfirmInput, regPasswordConfirmLabel, true);
                setPasswordFieldVisibility(regPasswordConfirmInput, toggleRegPasswordConfirm, iconEyeConfirm, iconEyeOffConfirm, false);
                regPasswordConfirmInput.classList.remove('success');
                setFieldError(regPasswordConfirmInput, false);
                setHidden(passwordMismatchError, true);
            } else {
                const wasLocked = setFieldLocked(regPasswordConfirmInput, regPasswordConfirmLabel, false);
                if (wasLocked && regPasswordConfirmInput.value.length > 0) {
                    setPasswordFieldVisibility(regPasswordConfirmInput, toggleRegPasswordConfirm, iconEyeConfirm, iconEyeOffConfirm, savedConfirmVisible);
                }
            }

            updateAllRegTogglesVisibility();
        }

        function updateConfirmValidation() {
            updateFilledClass(regPasswordConfirmInput);
            const confirmValue = regPasswordConfirmInput.value;
            const passwordValue = regPasswordInput.value;
            const confirmDisabled = isFieldLocked(regPasswordConfirmInput);
            const passwordDisabled = isFieldLocked(regPasswordInput);
            const isMatch = isPasswordValid && !confirmDisabled && confirmValue.length > 0 && confirmValue === passwordValue;

            if (!confirmDisabled && confirmValue.length > 0 && isPasswordValid && !isMatch) {
                setHidden(passwordMismatchError, false);
                setFieldError(regPasswordInput, true);
                setFieldError(regPasswordConfirmInput, true);
                setFieldSuccess(regPasswordInput, false);
                setFieldSuccess(regPasswordConfirmInput, false);
                isConfirmValid = false;
            } else {
                setHidden(passwordMismatchError, true);
                setFieldError(regPasswordConfirmInput, false);
                if (isPasswordValid && !confirmDisabled && !passwordDisabled) {
                    setFieldError(regPasswordInput, false);
                }
                if (isMatch) {
                    setFieldSuccess(regPasswordInput, true);
                    setFieldSuccess(regPasswordConfirmInput, true);
                    isConfirmValid = true;
                } else {
                    setFieldSuccess(regPasswordConfirmInput, false);
                    if (isPasswordValid && !passwordDisabled) {
                        setFieldSuccess(regPasswordInput, true);
                    } else {
                        setFieldSuccess(regPasswordInput, false);
                    }
                    isConfirmValid = false;
                }
            }
            updateRegisterButtonState();
        }

        function showPasswordRuleError(message) {
            passwordRuleError.textContent = message || PASSWORD_RULE_MESSAGE;
            setHidden(passwordRuleError, false);
            setFieldError(regPasswordInput, true);
            isPasswordValid = false;
            setFieldSuccess(regPasswordInput, false);
            updateFieldAvailability();
            updateConfirmValidation();
            updateRegisterButtonState();
        }

        function hidePasswordRuleError() {
            setHidden(passwordRuleError, true);
            setFieldError(regPasswordInput, false);
            isPasswordValid = isPasswordValidFunc(regPasswordInput.value) && !isPasswordMatchingUsername(regPasswordInput.value);
            setFieldSuccess(regPasswordInput, isPasswordValid);
            updateFieldAvailability();
            updateConfirmValidation();
            updateRegisterButtonState();
        }

        function updatePasswordValidation() {
            const value = regPasswordInput.value;
            updateFilledClass(regPasswordInput);

            if (!isLoginValid) {
                return;
            }

            if (value.length === 0) {
                hidePasswordRuleError();
                syncUsernameBorder();
                return;
            }
            if (!isPasswordValidFunc(value)) {
                showPasswordRuleError(PASSWORD_RULE_MESSAGE);
                syncUsernameBorder();
                return;
            }
            if (isPasswordMatchingUsername(value)) {
                showPasswordRuleError(PASSWORD_MATCHES_USERNAME_MESSAGE);
                forceUsernameError();
                return;
            }
            hidePasswordRuleError();
            syncUsernameBorder();
        }

        function updateLoginValidation() {
            const value = regUsernameInput.value;
            updateFilledClass(regUsernameInput);

            if (value.length === 0) {
                setHidden(loginRuleError, true);
                setFieldError(regUsernameInput, false);
                isLoginValid = false;
                setFieldSuccess(regUsernameInput, false);
                if (regPasswordInput.value.length > 0 || regPasswordConfirmInput.value.length > 0) {
                    regPasswordInput.value = '';
                    regPasswordConfirmInput.value = '';
                    confirmWasEmpty = true;
                    savedPasswordVisible = false;
                    savedConfirmVisible = false;
                    resetRegToggle();
                    setFieldError(regPasswordInput, false);
                    setFieldError(regPasswordConfirmInput, false);
                    setFieldSuccess(regPasswordInput, false);
                    setFieldSuccess(regPasswordConfirmInput, false);
                    isPasswordValid = false;
                    isConfirmValid = false;
                    setHidden(passwordRuleError, true);
                    setHidden(passwordMismatchError, true);
                    updateFilledClass(regPasswordInput);
                    updateFilledClass(regPasswordConfirmInput);
                }
                setFieldError(regPasswordInput, false);
                setFieldError(regPasswordConfirmInput, false);
                setFieldSuccess(regPasswordInput, false);
                setFieldSuccess(regPasswordConfirmInput, false);
            } else {
                const result = validateLogin(value);
                if (!result.valid) {
                    loginRuleError.textContent = result.message;
                    setHidden(loginRuleError, false);
                    setFieldError(regUsernameInput, true);
                    isLoginValid = false;
                    setFieldSuccess(regUsernameInput, false);
                } else {
                    setHidden(loginRuleError, true);
                    setFieldError(regUsernameInput, false);
                    isLoginValid = true;
                    setFieldSuccess(regUsernameInput, true);
                }
            }

            updateFieldAvailability();
            updateConfirmValidation();
            updateRegisterButtonState();

            if (isLoginValid && regPasswordInput.value.length > 0) {
                updatePasswordValidation();
            } else {
                syncUsernameBorder();
            }
        }

        function clearRegisterErrors() {
            setHidden(loginRuleError, true);
            passwordRuleError.textContent = PASSWORD_RULE_MESSAGE;
            setHidden(passwordRuleError, true);
            setHidden(passwordMismatchError, true);
            setFieldError(regUsernameInput, false);
            setFieldError(regPasswordInput, false);
            setFieldError(regPasswordConfirmInput, false);
            setFieldSuccess(regUsernameInput, false);
            setFieldSuccess(regPasswordInput, false);
            setFieldSuccess(regPasswordConfirmInput, false);
            updateFilledClass(regUsernameInput);
            updateFilledClass(regPasswordInput);
            updateFilledClass(regPasswordConfirmInput);
            isLoginValid = false;
            isPasswordValid = false;
            isConfirmValid = false;
            updateFieldAvailability();
            updateRegisterButtonState();
        }

        function setLoginPasswordVisibility(isVisible) {
            setPasswordFieldVisibility(loginPasswordInput, toggleLoginPassword, iconEyeLogin, iconEyeOffLogin, isVisible);
        }

        function updateLoginToggleVisibility() {
            const hasValue = loginPasswordInput.value.length > 0;
            setToggleShown(toggleLoginPassword, hasValue);
            if (!hasValue) {
                setLoginPasswordVisibility(false);
            }
        }

        function clearAllForms() {
            clearLoginForm();

            regUsernameInput.value = '';
            regPasswordInput.value = '';
            regPasswordConfirmInput.value = '';
            confirmWasEmpty = true;
            savedPasswordVisible = false;
            savedConfirmVisible = false;
            clearRegisterErrors();
            resetRegToggle();
            updateAllRegTogglesVisibility();
        }

        function activateLoginTab() {
            if (authBusy || document.body.classList.contains('captcha-open')) return;
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            authContainer.classList.remove('mode-register');
            authContainer.classList.add('tabs-ready');
            saveActiveTab('login');
            updateLoginToggleVisibility();
            setHidden(loginEmptyError, true);
        }

        function activateRegisterTab() {
            if (authBusy || document.body.classList.contains('captcha-open')) return;
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            authContainer.classList.add('mode-register');
            authContainer.classList.add('tabs-ready');
            saveActiveTab('register');
            setHidden(loginEmptyError, true);
            updateFilledClass(regUsernameInput);
            updateFilledClass(regPasswordInput);
            updateFilledClass(regPasswordConfirmInput);
            updateLoginValidation();
            updatePasswordValidation();
            updateConfirmValidation();
            updateFieldAvailability();
            updateRegisterButtonState();
            updateAllRegTogglesVisibility();
        }

        // bindNoSpaces — для полей, где пробелы запрещены полностью.
        [regUsernameInput, regPasswordInput, regPasswordConfirmInput]
            .forEach(function (input) {
                if (input) bindNoSpaces(input);
            });

        // loginPasswordInput — пробелы с клавиатуры разрешены,
        // но при вставке/перетаскивании они вырезаются.
        if (loginPasswordInput) bindPasteSanitize(loginPasswordInput);

        tabLogin.addEventListener('click', activateLoginTab);
        tabRegister.addEventListener('click', activateRegisterTab);

        loginUsernameInput.addEventListener('input', function () {
            updateFilledClass(loginUsernameInput);
            setHidden(loginEmptyError, true);
        });
        loginPasswordInput.addEventListener('input', function () {
            updateFilledClass(loginPasswordInput);
            setHidden(loginEmptyError, true);
            updateLoginToggleVisibility();
        });
        loginUsernameInput.addEventListener('change', function () {
            updateFilledClass(loginUsernameInput);
            setHidden(loginEmptyError, true);
        });
        loginPasswordInput.addEventListener('change', function () {
            updateFilledClass(loginPasswordInput);
            setHidden(loginEmptyError, true);
            updateLoginToggleVisibility();
        });

        toggleLoginPassword.addEventListener('mousedown', function (e) {
            e.preventDefault();
        });
        toggleLoginPassword.addEventListener('click', function () {
            const wasFocused = document.activeElement === loginPasswordInput;
            const caret = caretForToggle(loginPasswordInput);
            const isVisible = loginPasswordInput.getAttribute('type') !== 'text';
            setLoginPasswordVisibility(isVisible);
            if (wasFocused) {
                restoreCaret(loginPasswordInput, caret.start, caret.end);
            }
        });

        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (authBusy || document.body.classList.contains('captcha-open')) return;
            const isUsernameEmpty = loginUsernameInput.value.trim() === '';
            const isPasswordEmpty = loginPasswordInput.value === '';
            if (isUsernameEmpty || isPasswordEmpty) {
                setHidden(loginEmptyError, false);
                return;
            }
            playButtonAnimation(loginForm.querySelector('button[type="submit"]'), function () {
                loginCaptchaCtrl.show();
            });
        });

        function blockPasswordField() {
            if (isLoginEmpty() || !isLoginValid) {
                return true;
            }
            return false;
        }

        function checkConfirmAccess() {
            if (isLoginEmpty() || !isLoginValid) {
                return false;
            }
            if (regPasswordInput.value.trim() === '' || !isPasswordValid) {
                return false;
            }
            return true;
        }

        function bindLockedBlock(input) {
            input.addEventListener('mousedown', function (e) {
                if (!isFieldLocked(input)) return;
                e.preventDefault();
            });

            input.addEventListener('focus', function () {
                if (!isFieldLocked(input)) return;
                input.blur();
            });
        }

        bindLockedBlock(regPasswordInput);
        bindLockedBlock(regPasswordConfirmInput);

        function isRegisterFormReady() {
            return isLoginValid && isPasswordValid && isConfirmValid && !registerSubmitBtn.classList.contains('disabled-btn');
        }

        function submitRegisterForm() {
            registerForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }

        function areAllRegisterFieldsEmpty() {
            return regUsernameInput.value === '' &&
                   regPasswordInput.value === '' &&
                   regPasswordConfirmInput.value === '';
        }

        function handleEnterKey(e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();

            const currentInput = e.target;
            const form = currentInput.closest('form');

            if (form === loginForm) {
                loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
                return;
            }

            if (form === registerForm) {
                if (areAllRegisterFieldsEmpty()) {
                    regUsernameInput.focus();
                    return;
                }

                if (isRegisterFormReady()) {
                    submitRegisterForm();
                    return;
                }

                const inputs = Array.from(registerForm.querySelectorAll('input'));
                const currentIndex = inputs.indexOf(currentInput);
                const isLastInput = currentIndex === inputs.length - 1;

                let isCurrentValid = false;
                if (currentInput === regUsernameInput) isCurrentValid = isLoginValid;
                else if (currentInput === regPasswordInput) isCurrentValid = isPasswordValid;
                else if (currentInput === regPasswordConfirmInput) isCurrentValid = isConfirmValid;

                if (isCurrentValid) {
                    if (isLastInput) {
                        submitRegisterForm();
                    } else {
                        const nextInput = inputs[currentIndex + 1];
                        if (nextInput && !isFieldLocked(nextInput)) {
                            nextInput.focus();
                        }
                    }
                }
            }
        }

        document.querySelectorAll('.auth-form input').forEach(function (input) {
            input.addEventListener('keydown', handleEnterKey);
        });

        function handleCaptchaEnter(controller, e) {
            if (controller.isCaptchaSuccess()) {
                e.preventDefault();
                return;
            }
            const active = document.activeElement;
            if (active === controller.input) return;
            if (active && active.tagName === 'BUTTON') return;

            e.preventDefault();

            if (controller.input.value.length >= controller.cells.length) {
                controller.check();
            } else {
                controller.input.focus();
            }
        }

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' && e.key !== 'Esc') return;

            if (regCaptchaCtrl.isModalOpen()) {
                if (!regCaptchaCtrl.canClose()) return;
                e.preventDefault();
                regCaptchaCtrl.hide();
                hideAllVisiblePasswords();
                return;
            }
            if (loginCaptchaCtrl.isModalOpen()) {
                if (!loginCaptchaCtrl.canClose()) return;
                e.preventDefault();
                loginCaptchaCtrl.hide();
                hideAllVisiblePasswords();
                return;
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;

            if (regCaptchaCtrl.isModalOpen()) {
                handleCaptchaEnter(regCaptchaCtrl, e);
                return;
            }
            if (loginCaptchaCtrl.isModalOpen()) {
                handleCaptchaEnter(loginCaptchaCtrl, e);
                return;
            }

            if (registerForm.classList.contains('hidden')) return;

            const activeEl = document.activeElement;

            if (activeEl && activeEl.tagName === 'BUTTON') {
                const isRegisterSubmit = activeEl.closest('#registerForm') !== null;

                if (!isRegisterSubmit) return;

                if (isRegisterFormReady()) return;

                e.preventDefault();

                if (areAllRegisterFieldsEmpty()) {
                    regUsernameInput.focus();
                }
                return;
            }

            if (activeEl && activeEl.closest && activeEl.closest('#registerForm')) return;

            if (areAllRegisterFieldsEmpty()) {
                e.preventDefault();
                regUsernameInput.focus();
                return;
            }

            if (isRegisterFormReady()) {
                e.preventDefault();
                submitRegisterForm();
            }
        });

        regPasswordInput.addEventListener('focus', function () {
            if (blockPasswordField()) return;
            if (regPasswordInput.value.length === 0) {
                setFieldSuccess(regPasswordInput, false);
            }
        });

        regPasswordInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') return;
            if (isLoginEmpty() || !isLoginValid) {
                if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    blockPasswordField();
                }
            }
        });

        regUsernameInput.addEventListener('input', updateLoginValidation);
        regUsernameInput.addEventListener('change', updateLoginValidation);

        function onRegPasswordInput() {
            updatePasswordValidation();
            updateAllRegTogglesVisibility();
            if (regPasswordInput.value.length === 0) {
                regPasswordConfirmInput.value = '';
                confirmWasEmpty = true;
                savedPasswordVisible = false;
                savedConfirmVisible = false;
                resetRegToggle();
                setFieldError(regPasswordInput, false);
                setFieldSuccess(regPasswordInput, false);
                setFieldSuccess(regPasswordConfirmInput, false);
                updateFilledClass(regPasswordConfirmInput);
            }
        }

        regPasswordInput.addEventListener('input', onRegPasswordInput);
        regPasswordInput.addEventListener('change', onRegPasswordInput);

        function onRegConfirmInput() {
            const confirmIsNowEmpty = regPasswordConfirmInput.value.length === 0;
            const confirmJustBecameFilled = confirmWasEmpty && !confirmIsNowEmpty;

            if (confirmJustBecameFilled && regPasswordInput.value.length > 0 && !isFieldLocked(regPasswordConfirmInput)) {
                const mainIsVisible = regPasswordInput.getAttribute('type') === 'text';
                setPasswordFieldVisibility(regPasswordConfirmInput, toggleRegPasswordConfirm, iconEyeConfirm, iconEyeOffConfirm, mainIsVisible);
            }

            confirmWasEmpty = confirmIsNowEmpty;
            updateConfirmValidation();
            updateAllRegTogglesVisibility();
        }

        regPasswordConfirmInput.addEventListener('input', onRegConfirmInput);
        regPasswordConfirmInput.addEventListener('change', onRegConfirmInput);

        regPasswordConfirmInput.addEventListener('focus', function () {
            if (!checkConfirmAccess()) return;
            if (regPasswordConfirmInput.value.length === 0) {
                setFieldSuccess(regPasswordConfirmInput, false);
            }
        });

        regPasswordConfirmInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') return;
            if (!isLoginValid || !isPasswordValid || regPasswordInput.value.trim() === '') {
                if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    checkConfirmAccess();
                }
            }
        });

        function toggleRegPasswordVisibility(clickedButton) {
            const isPrimary = clickedButton === toggleRegPassword;
            const targetInput = isPrimary ? regPasswordInput : regPasswordConfirmInput;
            const otherInput = isPrimary ? regPasswordConfirmInput : regPasswordInput;
            const targetToggle = isPrimary ? toggleRegPassword : toggleRegPasswordConfirm;
            const otherToggle = isPrimary ? toggleRegPasswordConfirm : toggleRegPassword;
            const targetIconOn = isPrimary ? iconEyeReg : iconEyeConfirm;
            const targetIconOff = isPrimary ? iconEyeOffReg : iconEyeOffConfirm;
            const otherIconOn = isPrimary ? iconEyeConfirm : iconEyeReg;
            const otherIconOff = isPrimary ? iconEyeOffConfirm : iconEyeOffReg;

            const targetWasFocused = document.activeElement === targetInput;
            const otherWasFocused = document.activeElement === otherInput;

            const targetCaretStart = targetInput.selectionStart;
            const targetCaretEnd = targetInput.selectionEnd;
            const otherCaretStart = otherInput.selectionStart;
            const otherCaretEnd = otherInput.selectionEnd;

            const newState = targetInput.getAttribute('type') !== 'text';

            setPasswordFieldVisibility(targetInput, targetToggle, targetIconOn, targetIconOff, newState);

            if (isPrimary) savedPasswordVisible = newState;
            else savedConfirmVisible = newState;

            const targetHasValue = targetInput.value.length > 0;
            const otherHasValue = otherInput.value.length > 0;
            const otherDisabled = isFieldLocked(otherInput);

            if (targetHasValue && otherHasValue && !otherDisabled) {
                setPasswordFieldVisibility(otherInput, otherToggle, otherIconOn, otherIconOff, newState);
                if (isPrimary) savedConfirmVisible = newState;
                else savedPasswordVisible = newState;
            }

            updateAllRegTogglesVisibility();

            if (targetWasFocused) {
                restoreCaret(targetInput, targetCaretStart, targetCaretEnd);
            } else if (otherWasFocused) {
                restoreCaret(otherInput, otherCaretStart, otherCaretEnd);
            }
        }

        toggleRegPassword.addEventListener('mousedown', function (e) { e.preventDefault(); });
        toggleRegPasswordConfirm.addEventListener('mousedown', function (e) { e.preventDefault(); });

        toggleRegPassword.addEventListener('click', function () {
            if (isFieldLocked(regPasswordInput)) return;
            toggleRegPasswordVisibility(this);
        });
        toggleRegPasswordConfirm.addEventListener('click', function () {
            if (isFieldLocked(regPasswordConfirmInput)) return;
            toggleRegPasswordVisibility(this);
        });

        registerSubmitBtn.addEventListener('click', function (e) {
            if (isRegisterFormReady()) return;
            e.preventDefault();
        });

        window.addEventListener('resize', function () {
            if (regCaptchaCtrl.isModalOpen()) regCaptchaCtrl.align();
            if (loginCaptchaCtrl.isModalOpen()) loginCaptchaCtrl.align();
        });

        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (authBusy || document.body.classList.contains('captcha-open')) return;

            const username = regUsernameInput.value.trim();
            const password = regPasswordInput.value;
            const confirm = regPasswordConfirmInput.value;

            const loginResult = validateLogin(username);
            const basePasswordOk = isPasswordValidFunc(password);
            const sameAsUsername = username.length > 0 && password.length > 0 && password.toLowerCase() === username.toLowerCase();
            const passwordOk = basePasswordOk && !sameAsUsername;
            const confirmOk = password === confirm && confirm.length > 0 && passwordOk;

            if (!loginResult.valid || !passwordOk || !confirmOk) {
                isLoginValid = loginResult.valid;
                isPasswordValid = passwordOk;
                isConfirmValid = confirmOk;

                updateFieldAvailability();
                updateConfirmValidation();

                if (!loginResult.valid) {
                    loginRuleError.textContent = loginResult.message;
                    setHidden(loginRuleError, false);
                    setFieldError(regUsernameInput, true);
                    setFieldSuccess(regUsernameInput, false);
                }
                if (!basePasswordOk) {
                    passwordRuleError.textContent = PASSWORD_RULE_MESSAGE;
                    setHidden(passwordRuleError, false);
                    setFieldError(regPasswordInput, true);
                    setFieldSuccess(regPasswordInput, false);
                    syncUsernameBorder();
                } else if (sameAsUsername) {
                    passwordRuleError.textContent = PASSWORD_MATCHES_USERNAME_MESSAGE;
                    setHidden(passwordRuleError, false);
                    setFieldError(regPasswordInput, true);
                    setFieldSuccess(regPasswordInput, false);
                    forceUsernameError();
                }
                if (!confirmOk && passwordOk) {
                    setHidden(passwordMismatchError, false);
                    setFieldError(regPasswordInput, true);
                    setFieldError(regPasswordConfirmInput, true);
                    setFieldSuccess(regPasswordInput, false);
                    setFieldSuccess(regPasswordConfirmInput, false);
                }

                updateRegisterButtonState();
                return;
            }

            playButtonAnimation(registerSubmitBtn, function () {
                regCaptchaCtrl.show();
            });
        });

        function hideAllVisiblePasswords() {
            if (loginPasswordInput.getAttribute('type') === 'text') {
                setLoginPasswordVisibility(false);
            }
            if (regPasswordInput.getAttribute('type') === 'text' && !isFieldLocked(regPasswordInput)) {
                savedPasswordVisible = false;
                setPasswordFieldVisibility(regPasswordInput, toggleRegPassword, iconEyeReg, iconEyeOffReg, false);
            }
            if (regPasswordConfirmInput.getAttribute('type') === 'text' && !isFieldLocked(regPasswordConfirmInput)) {
                savedConfirmVisible = false;
                setPasswordFieldVisibility(regPasswordConfirmInput, toggleRegPasswordConfirm, iconEyeConfirm, iconEyeOffConfirm, false);
            }
            updateAllRegTogglesVisibility();
        }

        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        regUsernameInput.value = '';
        regPasswordInput.value = '';
        regPasswordConfirmInput.value = '';
        confirmWasEmpty = true;
        savedPasswordVisible = false;
        savedConfirmVisible = false;

        updateFilledClass(loginUsernameInput);
        updateFilledClass(loginPasswordInput);
        updateFilledClass(regUsernameInput);
        updateFilledClass(regPasswordInput);
        updateFilledClass(regPasswordConfirmInput);

        setLoginPasswordVisibility(false);
        updateLoginToggleVisibility();
        resetRegToggle();
        updateAllRegTogglesVisibility();
        clearRegisterErrors();
        setHidden(loginEmptyError, true);

        let savedTab = 'login';
        try {
            savedTab = sessionStorage.getItem(ACTIVE_TAB_KEY) || 'login';
        } catch (e) {
            savedTab = 'login';
        }

        if (savedTab === 'register') {
            activateRegisterTab();
        } else {
            activateLoginTab();
        }
    });
})();
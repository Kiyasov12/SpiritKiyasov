
async function sendRequest(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
    };

    if (data !== null) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    let result;

    try {
        result = await response.json();
    } catch {
        result = {};
    }

    if (!response.ok) {
        throw new Error(
            result.message || `Ошибка сервера: ${response.status}`
        );
    }

    return result;
}

function showMessage(element, message, type = 'error') {
    element.textContent = message;
    element.className = `message ${type}`;
}

// Регистрация
const registerForm = document.getElementById('registerForm');

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const login = document.getElementById('login').value.trim();
        const password = document.getElementById('password').value;
        const message = document.getElementById('registerMessage');
        const button = document.getElementById('registerButton');

        message.textContent = '';
        button.disabled = true;
        button.textContent = 'Регистрация...';

        try {
            const result = await sendRequest(
                '/api/auth/register',
                'POST',
                { login, password }
            );

            showMessage(
                message,
                result.message || 'Аккаунт создан! Теперь войди.',
                'success'
            );

            registerForm.reset();

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1200);
        } catch (error) {
            showMessage(message, error.message);
        } finally {
            button.disabled = false;
            button.textContent = 'Зарегистрироваться';
        }
    });
}

// Вход
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const login = document.getElementById('login').value.trim();
        const password = document.getElementById('password').value;
        const message = document.getElementById('loginMessage');
        const button = document.getElementById('loginButton');

        message.textContent = '';
        button.disabled = true;
        button.textContent = 'Входим...';

        try {
            await sendRequest(
                '/api/auth/login',
                'POST',
                { login, password }
            );

            window.location.href = 'profile.html';
        } catch (error) {
            showMessage(message, error.message);
        } finally {
            button.disabled = false;
            button.textContent = 'Войти';
        }
    });
}

// Загрузка профиля
const profileLogin = document.getElementById('profileLogin');

if (profileLogin) {
    async function loadProfile() {
        try {
            const result = await sendRequest('/api/auth/me');
            const user = result.user || result;

            if (!user || !user.login) {
                throw new Error('Не удалось получить данные пользователя');
            }

            profileLogin.textContent = user.login;

            document.getElementById('profileRole').textContent =
                user.role || 'Пользователь';

            document.getElementById('profileAvatar').textContent =
                user.login.charAt(0).toUpperCase();
        } catch (error) {
            if (error.message.includes('401')) {
                window.location.href = 'index.html';
                return;
            }

            showMessage(
                document.getElementById('profileMessage'),
                error.message
            );

            if (error.message.toLowerCase().includes('войти')) {
                window.location.href = 'index.html';
            }
        }
    }

    loadProfile();
}

// Выход
const logoutButton = document.getElementById('logoutButton');

if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        logoutButton.disabled = true;

        try {
            await sendRequest('/api/auth/logout', 'POST');
            window.location.href = 'index.html';
        } catch (error) {
            showMessage(
                document.getElementById('profileMessage'),
                error.message
            );

            logoutButton.disabled = false;
        }
    });
}

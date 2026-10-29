
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
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const middleName = document.getElementById('middleName').value.trim();

        message.textContent = '';
        button.disabled = true;
        button.textContent = 'Регистрация...';

        try {
            const result = await sendRequest(
                '/api/auth/register',
                'POST',
                {
                    login,
                    password,
                    firstName,
                    lastName,
                    middleName
                }
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

function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString('ru-RU');
}

function formatDateTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('ru-RU');
}

function showList(containerId, items, renderItem, emptyText) {
    const container = document.getElementById(containerId);
    container.replaceChildren();

    if (!items || items.length === 0) {
        container.textContent = emptyText;
        return;
    }

    items.forEach((item) => {
        const element = document.createElement('div');
        element.className = 'data-item';

        // renderItem создаёт безопасные DOM-элементы
        renderItem(element, item);
        container.appendChild(element);
    });
}

function addLine(container, label, value, accent = false) {
    const line = document.createElement('div');
    const title = document.createElement('strong');
    const text = document.createElement('span');

    title.textContent = label + ': ';
    text.textContent = value ?? '—';

    if (accent) {
        text.className = 'accent';
    }

    line.append(title, text);
    container.appendChild(line);
}

// Загрузка профиля
const profileLogin = document.getElementById('profileLogin');

if (profileLogin) {
    async function loadProfile() {
        const message = document.getElementById('profileMessage');

        try {
            const result = await sendRequest('/api/profile');
            const user = result.user;

            profileLogin.textContent = user.login;
            document.getElementById('profileRole').textContent =
                user.role || 'Пользователь';

            document.getElementById('profileAvatar').textContent =
                user.login.charAt(0).toUpperCase();

            const client = result.client;

            if (client) {
                const fullName = [
                    client.last_name,
                    client.first_name,
                    client.middle_name
                ].filter(Boolean).join(' ');

                document.getElementById('clientName').textContent =
                    fullName || 'Не указано';

                document.getElementById('clientPhone').textContent =
                    client.phone || 'Не указан';

                document.getElementById('clientEmail').textContent =
                    client.email || 'Не указан';
            } else {
                document.getElementById('clientName').textContent =
                    'Аккаунт не связан с клиентом';

                document.getElementById('clientPhone').textContent = '—';
                document.getElementById('clientEmail').textContent = '—';
            }

            showList(
                'membershipsList',
                result.memberships,
                (element, item) => {
                    addLine(element, 'Абонемент', item.membership_name);
                    addLine(element, 'Начало', formatDate(item.start_date));
                    addLine(element, 'Окончание', formatDate(item.end_date));
                    addLine(element, 'Статус', item.status, true);
                    addLine(
                        element,
                        'Стоимость',
                        `${item.price_at_purchase} ₽`
                    );
                },
                'Абонементов пока нет.'
            );

            showList(
                'visitsList',
                result.visits,
                (element, item) => {
                    addLine(element, 'Дата посещения', formatDateTime(item.visit_time));
                    addLine(element, 'Абонемент', item.membership_name);
                    addLine(
                        element,
                        'Время выхода',
                        item.exit_time
                            ? formatDateTime(item.exit_time)
                            : 'Ещё не отмечен'
                    );
                },
                'Посещений пока нет.'
            );

            showList(
                'paymentsList',
                result.payments,
                (element, item) => {
                    addLine(element, 'Дата', formatDateTime(item.payment_date));
                    addLine(element, 'Абонемент', item.membership_name);
                    addLine(element, 'Сумма', `${item.amount} ₽`);
                    addLine(element, 'Способ оплаты', item.payment_method);
                    addLine(element, 'Статус', item.status, true);
                },
                'Платежей пока нет.'
            );
        } catch (error) {
            if (error.message.toLowerCase().includes('войти')) {
                window.location.href = 'index.html';
                return;
            }

            showMessage(message, error.message);
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

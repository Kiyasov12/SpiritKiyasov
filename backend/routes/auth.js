
// // function requireAuth(req, res, next) {
// //     if (!req.session.user) {
// //         return res.status(401).json({
// //             message: 'Необходимо войти в систему'
// //         });
// //     }

// //     next();
// // }

// // function requireRole(...allowedRoles) {
// //     return (req, res, next) => {
// //         if (!req.session.user) {
// //             return res.status(401).json({
// //                 message: 'Необходимо войти в систему'
// //             });
// //         }

// //         if (!allowedRoles.includes(req.session.user.role)) {
// //             return res.status(403).json({
// //                 message: 'Недостаточно прав доступа'
// //             });
// //         }

// //         next();
// //     };
// // }

// // module.exports = {
// //     requireAuth,
// //     requireRole
// // };

// const express = require('express');

// const router = express.Router();

// router.get('/', (req, res) => {
//     res.json({
//         message: 'Маршруты авторизации работают'
//     });
// });

// module.exports = router;


const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

// РЕГИСТРАЦИЯ

router.post('/register', async (req, res) => {
    const login = String(req.body.login || '').trim();
    const password = String(req.body.password || '');
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const middleName = String(req.body.middleName || '').trim();

    if (
        login.length < 3 ||
        login.length > 50 ||
        password.length < 8 ||
        password.length > 72 ||
        !firstName ||
        !lastName
    ) {
        return res.status(400).json({
            message: 'Укажи имя, фамилию, логин от 3 до 50 символов и пароль от 8 символов'
        });
    }

    const db = await pool.connect();

    try {
        await db.query('BEGIN');

        const existingUser = await db.query(
            'SELECT id FROM users WHERE login = $1',
            [login]
        );

        if (existingUser.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(409).json({
                message: 'Такой логин уже занят'
            });
        }

        const roleResult = await db.query(
            'SELECT id FROM roles WHERE name = $1',
            ['Пользователь']
        );

        if (roleResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(500).json({
                message: 'Роль пользователя не найдена в базе данных'
            });
        }

        // Создаём клиента
        const clientResult = await db.query(
            `INSERT INTO clients (
                last_name,
                first_name,
                middle_name,
                is_active,
                created_at
            )
            VALUES ($1, $2, $3, TRUE, NOW())
            RETURNING id`,
            [
                lastName,
                firstName,
                middleName || null
            ]
        );

        const clientId = clientResult.rows[0].id;

        // Создаём аккаунт и связываем его с клиентом
        const passwordHash = await bcrypt.hash(password, 12);

        await db.query(
            `INSERT INTO users (
                login,
                password_hash,
                role_id,
                client_id,
                is_active,
                created_at
            )
            VALUES ($1, $2, $3, $4, TRUE, NOW())`,
            [
                login,
                passwordHash,
                roleResult.rows[0].id,
                clientId
            ]
        );

        await db.query('COMMIT');

        res.status(201).json({
            message: 'Регистрация прошла успешно'
        });
    } catch (error) {
        await db.query('ROLLBACK');

        console.error('Ошибка регистрации:', error);

        res.status(500).json({
            message: 'Не удалось зарегистрировать пользователя'
        });
    } finally {
        db.release();
    }
});


// ВХОД
router.post('/login', async (req, res) => {
    try {
        const { login, password } = req.body;

        if (typeof login !== 'string' ||
            typeof password !== 'string') {
            return res.status(400).json({
                message: 'Введите логин и пароль'
            });
        }

        const result = await pool.query(
            `SELECT
                u.id,
                u.login,
                u.password_hash,
                u.is_active,
                r.name AS role
             FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE u.login = $1`,
            [login.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: 'Неверный логин или пароль'
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                message: 'Учётная запись отключена'
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Неверный логин или пароль'
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error(error);

                return res.status(500).json({
                    message: 'Не удалось создать сессию'
                });
            }

            req.session.user = {
                id: user.id,
                login: user.login,
                role: user.role
            };

            req.session.save((error) => {
                if (error) {
                    console.error(error);

                    return res.status(500).json({
                        message: 'Не удалось сохранить сессию'
                    });
                }

                return res.json({
                    message: 'Вход выполнен успешно',
                    user: req.session.user
                });
            });
        });
    } catch (error) {
        console.error('Ошибка входа:', error.message);

        return res.status(500).json({
            message: 'Внутренняя ошибка сервера'
        });
    }
});

// ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
router.get('/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            message: 'Вы не авторизованы'
        });
    }

    return res.json({
        user: req.session.user
    });
});

// ВЫХОД
router.post('/logout', (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie('connect.sid');

        return res.json({
            message: 'Вы вышли из системы'
        });
    });
});

// ПРОВЕРКА МАРШРУТА
router.get('/', (req, res) => {
    res.json({
        message: 'Маршруты авторизации работают'
    });
});

module.exports = router;


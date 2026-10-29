
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
    try {
        const { login, password } = req.body;

        if (typeof login !== 'string' ||
            typeof password !== 'string') {
            return res.status(400).json({
                message: 'Введите логин и пароль'
            });
        }

        const cleanLogin = login.trim();

        if (cleanLogin.length < 3 || cleanLogin.length > 50) {
            return res.status(400).json({
                message: 'Логин должен содержать от 3 до 50 символов'
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                message: 'Пароль должен содержать от 8 до 72 символов'
            });
        }

        const existingUser = await pool.query(
            'SELECT id FROM users WHERE login = $1',
            [cleanLogin]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: 'Этот логин уже занят'
            });
        }

        const roleResult = await pool.query(
            'SELECT id FROM roles WHERE name = $1',
            ['Пользователь']
        );

        if (roleResult.rows.length === 0) {
            return res.status(500).json({
                message: 'Роль пользователя не найдена'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            `INSERT INTO users
                (login, password_hash, role_id, is_active)
             VALUES ($1, $2, $3, TRUE)`,
            [cleanLogin, passwordHash, roleResult.rows[0].id]
        );

        return res.status(201).json({
            message: 'Регистрация прошла успешно'
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                message: 'Этот логин уже занят'
            });
        }

        console.error('Ошибка регистрации:', error.message);

        return res.status(500).json({
            message: 'Внутренняя ошибка сервера'
        });
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


    const cors    = require("cors");
    const express = require("express");
    const app     = express();
    const mysql   = require('mysql');
    const redis   = require('redis');

    // Set up CORS
    const corsOptions = {
        origin: "http://localhost:3000"
    };
    app.use(cors(corsOptions));

    // Set json for getting data from request body
    app.use(express.json());

    // Redis setup


    const ConnectRedis = redis.createClient({
        socket:{
            host: 'redis',
            port: 6379,
        }
    });

    ConnectRedis.on('error', err => console.log('Redis Client Error', err));

     ConnectRedis.connect().then(() => {
        console.log("Hiiii!")
     });
    // MySQL setup
    const DB = mysql.createConnection({
        host    : 'mysql',
        user    : 'root',
        password: 'root',
        database: 'redis-mysql',
    });

    // Connect to MySQL
    DB.connect((err) => {
        if (err) throw err;
        console.log('MySQL connected');
    });
    // Routes
    app.get('/', (req, res) => {
        res.send('<h1 style="text-align: center;">Welcome to the Todo List API!</h1>');
    });

    // Fetching data from Database or Redis
    app.get('/todos', async (req, res) => {
        console.log("====================  Inner ========================")
        try {
            let redisClient = ConnectRedis
            // Check if cached data exists in Redis or not. If yes, return cached data
            const cachedData = await redisClient.get('todos');
            console.log('cachedData -->', cachedData)
            if (cachedData) {
                return res.send({
                    success: true,
                    message: 'Todos retrieved from cache successfully!',
                    data   : JSON.parse(cachedData)
                });
            }

            // If cached data doesn't exist, fetch data from database and cache it
            const results = await new Promise((resolve, reject) => {
                DB.query('SELECT * FROM todos', (err, results) => {
                    if (err) reject(err);
                    resolve(results);
                });
            });
            console.log('results --->', results)
            // If no data found in database, return error message
            if (!results.length) {
                return res.send({
                    success: false,
                    message: 'No todos found!',
                    data   : results
                });
            }else{
                console.log("+++++++++++++++")
            }
            // Cache data in Redis for 1 hour (3600 seconds)
            await redisClient.setEx('todos', 3600, JSON.stringify(results));

            // Return response
            return res.send({
                success: true,
                message: 'Todos retrieved from database successfully!',
                data   : results
            });
        } catch (error) { // Catch any error
            throw error;
        }
    });


    // Create new todo/ Add todo
    app.post('/todos', async(req, res) => {
        // Get data from request body
        const {title, description} = req.body;
        // let redisClient = await ConnectRedis()

        // Insert todo into database
        DB.query('INSERT INTO todos (title, description) VALUES (?, ?)', [title, description], (err, results) => {
            if (err) throw err; // Throw error if any

            // If no rows affected, then todo not inserted
            if (!results.affectedRows) {
                return res.send({
                    success: false,
                    message: 'Todo not added!',
                    data   : results
                });
            }

            // Delete cached data from Redis
            // redisClient.del('todos');

            // Return response
            return res.send({
                success: true,
                message: 'Todo added successfully!',
                data   : {
                    id: results.insertId,
                    title,
                    description
                }
            });
        });
    });

    // Update todo
    app.put('/todos/:id', async(req, res) => {
        // Get data from request body
        const {title, description} = req.body;
        let redisClient = await ConnectRedis()

        // Update todo in database
        DB.query('UPDATE todos SET title = ?, description = ? WHERE id = ?', [title, description, req.params.id], (err, results) => {
            if (err) throw err; // Throw error if any

            // If no rows affected, then todo not updated
            if (!results.affectedRows) {
                return res.send({
                    success: false,
                    message: 'Todo not updated!',
                    data   : results
                });
            }

            // Delete cached data from Redis
            redisClient.del('todos');

            // Return response
            return res.send({
                success: true,
                message: 'Todo updated successfully!',
                data   : {
                    id: req.params.id,
                    title,
                    description
                }
            });
        });
    });

    // Delete todo
    app.delete('/todos/:id', async(req, res) => {
        let redisClient = await ConnectRedis()


        DB.query('DELETE FROM todos WHERE id = ?', [req.params.id], (err, results) => {
            if (err) throw err; // Throw error if any

            // If no rows affected, then todo not deleted
            if (!results.affectedRows) {
                return res.send({
                    success: false,
                    message: 'Todo not deleted!',
                    data   : results
                });
            }

            // Delete cached data from Redis
            redisClient.del('todos');

            // Return response
            return res.send({
                success: true,
                message: 'Todo deleted successfully!'
            });
        });
    });

    // Start server
    const port = 5000;

    // Listen on port
    app.listen(port, () => {
        console.log(`Running at - http://localhost:${port}`);
    });
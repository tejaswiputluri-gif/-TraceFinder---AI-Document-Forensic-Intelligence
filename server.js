require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tracefinder';
const client = new MongoClient(uri);
const PORT = Number(process.env.NODE_PORT || 5001);

let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db('tracefinder');
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

app.get('/health', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ status: 'connecting' });
    }
    const admin = db.admin();
    const result = await admin.ping();
    res.json({ status: 'ok', mongodb: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections', async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    res.json({ collections: collections.map(c => c.name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const users = db.collection('users');
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await users.insertOne({ name, email, password: hashedPassword, createdAt: new Date().toISOString() });
    res.json({ message: 'Signup successful', userId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const users = db.collection('users');
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ message: 'Login successful', user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/records', async (req, res) => {
  try {
    const record = req.body;
    if (!record || Object.keys(record).length === 0) {
      return res.status(400).json({ error: 'JSON body required.' });
    }
    const collection = db.collection('records');
    const result = await collection.insertOne(record);
    res.json({ message: 'Record inserted successfully', insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/records', async (req, res) => {
  try {
    const collection = db.collection('records');
    const records = await collection.find({}).toArray();
    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connectToDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

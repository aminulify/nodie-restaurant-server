const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

// Nodemailer Mailgun setup
const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');

// middleware 
app.use(cors());
app.use(express.json());

// send payment confirmation email 
const auth = {
  auth: {
    api_key: '2456541b17e390ea42e18dbe75290c63-51356527-53b289f8',
    domain: process.env.EMAIL_DOMAIN
  }
}

const transporter = nodemailer.createTransport(mg(auth));

const sendPaymentConfirmationEmail = payment => transporter.sendMail({
  from: 'mdfahad1024@gmail.com',
  to: 'aminulify@gmail.com', // An array if you have multiple recipients.
  subject: 'Your order is confirmed. Enjoy the food soon!',
  //You can use "html:" to send HTML email content. It's magic!
  html: `
    <div>
      <h2>Payment Confirmed!</h2>
      <p>Transaction id: ${payment.transactionId}</p>
    </div>
  `,
  //You can use "text:" to send plain-text content. It's oldschool!
  text: 'Author Aminul'
}, (err, info) => {
  if (err) {
    console.log(`Error: ${err}`);
  }
  else {
    console.log(`Response: ${info.response}`);
  }
});

const verifyJWT = (req, res, next)=>{

  const authorization = req.headers.authorization;
  // console.log('first check authorization',authorization);
  
  if(!authorization){
    console.log('error 1');
    return res.status(401).send({error: true, message: 'unauthorized access'});
  }

  // authorization example: bearer token 
  // after split show ['bearer'],[token]; fist index bearer and second index token
  // console.log('author',authorization);
  const token = authorization.split(' ')[1]; 
  // console.log(process.env.ACCESS_TOKEN_SECRET, 'token check',token);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      console.log('error 2')
      return res.status(401).send({error: true, message: 'unauthorize access'})
    }
    // console.log('ddecoed',decoded);
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@cluster0.cm7riuy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('bistroRestaurantBD').collection('users');
    const menuCollection = client.db('bistroRestaurantBD').collection('menu');
    const reviewsCollection = client.db('bistroRestaurantBD').collection('reviews');
    const cartCollection = client.db('bistroRestaurantBD').collection('carts');
    const paymentCollection = client.db('bistroRestaurantBD').collection('payments');
    const bookingsCollection = client.db('bistroRestaurantBD').collection('bookings');

    // jwt 
    app.post('/jwt', (req,res)=>{
      const user = req.body;
      // console.log('user', user);
      const token = jwt.sign( user, process.env.ACCESS_TOKEN_SECRET ); 
      // const token = jwt.sign( user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' } ); 
      res.send({ token });
    });
    
    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async(req, res, next)=>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);

      if(user?.role!=='admin'){
        return res.status(403).send({error:true, message: 'forbidden message'})
      }
      next();
    }


    // users 
    app.post('/users', async(req,res)=>{
      const user = req.body;
      // console.log(user);
  
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
        return res.send({ message: 'User email already exists!' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    /**
     * use jwt token:
     * 1. verifyJWT
     * 2. use verify admin
     */
    app.get('/users', verifyJWT, verifyAdmin, async(req,res)=>{
      const result = await usersCollection.find().toArray();
      // console.log(result);
      res.send(result);
    })

    app.delete('/users/:id',async(req,res)=>{
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    // admin set / user role update
    app.patch('/users/admin/:id', async(req,res)=>{
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })


    // Is user admin check ?
    /**
     * security layer: 
     * 1. verifyJWT
     * 2. email same ?
     * 3. check role admin?
     */
    app.get('/user/admin/:email', verifyJWT, async(req,res)=>{
      const email = req.params.email;

      // check token user email and this user email both are same? 
      if(req.decoded.email !== email){
        res.send({admin: false});
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      // console.log('check user admin',result);
      res.send(result);
    })


    // menu related 
    app.get('/menu', async(req,res)=>{
        const result = await menuCollection.find().toArray();
        // console.log(result);
        res.send(result);
    })

    app.get('/menu/category/:id', async(req,res)=>{
      const id = req.params.id; 
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(filter);
      res.send(result);
    })

    app.post('/menu', verifyJWT, verifyAdmin, async(req, res)=>{
      const newItem = req.body;
  
      const result = await menuCollection.insertOne(newItem)
      res.send(result);
    })

    app.delete('/menu/:id', verifyJWT, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    app.put('/menu/:id', verifyJWT, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const options = { upsert: true };

      const update = req.body;
      const updateDoc = {
        $set: {
          name: update.name,
          category: update.category,
          price: update.price,
          recipe: update.recipe,
        }
      }
      const result = await menuCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })

    app.get('/reviews', async(req,res)=>{
        const result = await reviewsCollection.find().sort({_id: -1}).toArray();
        // sort({_id: -1}) // sort it new data show first
        // console.log(result);
        res.send(result);
    })


    app.post('/reviews', async(req, res)=>{
      const query = req.body;
      const result =  await reviewsCollection.insertOne(query);
      res.send(result);
    })

    app.post('/bookings', async(req,res)=>{
      const query = req.body;
      const result = await bookingsCollection.insertOne(query);
      res.send(result);
    })

    app.get('/bookings/:email', async(req,res)=>{
      const email = req.params.email;
      const query = {email: email};
      const result = await bookingsCollection.find(query).sort({_id: -1}).toArray();
      res.send(result);
    })

    app.get('/bookings', async(req,res)=>{
      const result = await bookingsCollection.find().sort({_id: -1}).toArray();
      res.send(result);
    })

    app.delete('/bookings/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/bookings/:id', async(req,res)=>{
      const id = req.params.id;
      // console.log(id);
      const query = {_id: new ObjectId(id)};

      const updateDoc = {
        $set: {
          status: "Approved"
        }
      }
      const result = await bookingsCollection.updateOne(query, updateDoc);
      // console.log(result);
      res.send(result);
    })


    // cart collection 
    app.post('/carts', async(req,res)=>{
      const item = req.body;
      // console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })

    app.get('/carts', verifyJWT, async(req, res)=>{
      const email = req.query.email;
      // console.log(email);

      if(!email){
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
    
      // console.log('deEmail',decodedEmail, 'email', email);

      if(email !== decodedEmail){
        // console.log('error3');
        return res.status(403).send({error: true, message: 'Forbidden Access'})
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      // console.log(result);
      res.send(result);
    })

    app.get('/cart_orders', async(req,res)=>{
      const result = await cartCollection.find().toArray();
      res.send(result);
    })

    // get all users products of admin 
    app.get('/all_products', async(req, res)=>{
        const result = await cartCollection.find().toArray();
        // console.log(result);
        res.send(result);     
    })

    app.delete('/carts/:id', async(req,res)=>{
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // create payment intent stripe 
   app.post('/create-payment-intent',  async(req,res)=>{
    const {price} = req.body;
    // console.log(price);
    const OrderAmount = ((price*100).toFixed(1)*1);
    // console.log(OrderAmount);
    const paymentIntent = await stripe.paymentIntents.create({
      
      amount: OrderAmount,
      currency: "usd",
      payment_method_types: ["card"],
    })
    // console.log('send 1');
    // console.log(paymentIntent.client_secret);
    res.send({
      clientSecret: paymentIntent.client_secret
    })
   })

  //  payment received data api
  app.post('/payments', async(req,res)=>{
    const payment = req.body;
    // console.log(payment);
    const insertResult = await paymentCollection.insertOne(payment);
    
    const query = {_id: {$in: payment.cardItems.map(id => new ObjectId(id))}};
    const deleteResult = await cartCollection.deleteMany(query);

    // send an email confirming payment
     sendPaymentConfirmationEmail(payment);
    // console.log(insertResult, deleteResult);
    res.send({insertResult, deleteResult});
  }) 


  app.get('/admin-stats', verifyJWT, verifyAdmin, async(req,res)=>{
    const users = await usersCollection.estimatedDocumentCount();
    const products = await menuCollection.estimatedDocumentCount();

    // *** best way to get sum of a field is to use group and sum operation 
    // const revenue = paymentCollection.aggregate([
    //   {
    //     $group: {
    //       _id: null,
    //       totalAmount: { $sum: '$price' },
    //     },
    //   },
    // ]).toArray();
    const payments = await paymentCollection.find().toArray();
    
    const orders = payments.reduce((sum, currentValue)=> sum + currentValue.menuItems.length, 0);

    const revenue = payments.reduce((sum, currentValue)=> sum + currentValue.price, 0).toFixed(2);

    res.send({
      users, products, orders, revenue
    })
  })


  app.get('/order-stats', async(req,res)=>{ 
    const pipeline = [
      
      // Convert string IDs to ObjectIds
      {
        $addFields: {
          menuItemObjectId: {
            $map: {
              input: '$menuItems',
              as: 'menuItem',
              in: { $convert: { input: '$$menuItem', to: 'objectId' } }
            }
          }
        }
      },

      // Lookup to join the menu collection based on the menu item IDs
      {
        $lookup: {
          from: 'menu',
          localField: 'menuItemObjectId',
          foreignField: '_id',
          as: 'menuItemDetails'
        }
      },
      
      // Unwind the menuItemDetails array to have individual menu items
      { $unwind: '$menuItemDetails' },
      
      // Group by category and calculate the number of items and total price
      {
        $group: {
          _id: '$menuItemDetails.category',
          itemCount: { $sum: 1 },
          totalCategoryPrice: { $sum: '$menuItemDetails.price' }
        }
      },
    
    ];

    const result = await paymentCollection.aggregate(pipeline).toArray();
    // console.log(result);
    res.send(result);
  })

  // payment history 
  app.get('/user_payout/:email', async(req,res)=>{
    const email = req.params.email;
    // console.log(email);
    const value = {email: email}
    const result = await paymentCollection.find(value).toArray();
    // console.log(result);
    res.send(result);

  })

  app.get('/all_payout', async(req,res)=>{
    const result = await paymentCollection.find().toArray();
    res.send(result);
  })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send('Nodie Cods Restaurant Is Running')
})
app.listen(port,()=>{
    console.log(`Nodie Cods Restaurant Is Running ${port}`);
})



/**
 * 
 * 
 * ------------------
 *   NAMING CONVENTION
 * ----------------------
 * USER : userCollection
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.patch('/users/:id')
 * app.put('/users/:id')
 * app.delete('/users/:id')
 * 
 * 
 */
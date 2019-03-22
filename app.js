const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const cors = require('cors')
const TWO_HOURS = 1000 * 60 * 60 * 2

const app = express();
app.use(cors());

const users = []		//holds user information from database and newly created users


var pg = require("pg");			//postgres

var nodemailer = require('nodemailer');		//nodemailer forgot my password
var transporter = nodemailer.createTransport({	//set bank email password
 service: 'gmail',
 auth: {
        user: 'bankteam160@gmail.com',
        pass: 'Bankteam160cs'
    }
});


var connectionString = {		//connect to db
   host: 'ec2-54-221-243-211.compute-1.amazonaws.com',
    port: 5432,
    user: 'xmfxzigqqctouo',
    password: 'c32fb92ec8652dd3837ed8423fa1eef3938b939ddb06235b19150f883871a087',
    database: 'dbds5lgqf1gspn',
}

var pool = new pg.Pool(connectionString);

const userTransaction = []		//holds user information from database and newly created users

pool.connect(function(err, client, done) {

    const query = client.query(new pg.Query("SELECT * from customer_info"))
    query.on('row', (row) => {	//push data from database to data structure
	 users.push(row);
    })
    query.on('error', (res) => {	//error
        console.log(res);
    })
	
    const queryT = client.query(new pg.Query("SELECT * from transaction"))	//transaction data push from database
    queryT.on('row', (row) => {	//push data from database to data structure
	 userTransaction.push(row);
    })
    queryT.on('error', (res) => {	//error
        console.log(res);
    })

    done()
})


const{
	PORT = process.env.PORT || 8080,
	NODE_ENV = 'development',
	SESS_NAME = 'sid',
	SESS_SECRET = 'ssh!quiet,it\'asecret!',
	SESS_LIFETIME = TWO_HOURS

}  = process.env

const IN_PROD = NODE_ENV === 'production'


app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
	extended:true
}))

app.use(session({

	name:  SESS_NAME, 
	resave: false,
	saveUninitialized: false,
	secret: SESS_SECRET, 
	cookie:{
		maxAge: SESS_LIFETIME,
		sameSite: true,
		secure: IN_PROD
	}
}))


const redirectLogin = (req, res, next) => {

	if(!req.session.userId){
		res.redirect('/login')
	}else{
		next()
	}

}

const redirectHome = (req, res, next) => {

	if(req.session.userId){
		res.redirect('/home')
	}else{
		next()
	}

}

app.use((req, res, next)=>{
	const {userId} = req.session
	if(userId){
		res.locals.user = users.find(user => user.id === userId)
	}
	next()
})


app.post('/api/validateUser', (req, res) => {			//api for validating user when signing in
	console.log('validateLogin called');

	const{email, password, customer} = req.body;

	if(email && password){
		const user = users.find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password);
		
		const specificTransaction = []		//holds user information from database and newly created users
		const allTransaction = []		//holds all transactions, this is for bank manager

		if(user){

			req.session.userId = user.id;
			let val = 'Valid Login' + user.customer; //1 represents customer, 0 represents manager
			
			if(user.customer == 1){
				pool.connect(function(err, client, done) {

				    const query = client.query(new pg.Query("SELECT date, amount, balance from transaction where email=$1 order by date desc", [user.email]))
				    query.on('row', (row) => {	//push transaction of user from database to data structure
					    specificTransaction.push(row);
				    })
				    query.on('error', (res) => {	//error
					console.log(res);
				    })
				   query.on("end", function (result) {
					res.json({value:val, transactions:specificTransaction, first_name: user.first_name, last_name: user.last_name, email: user.email});
				    });

				    done()
				})
			}else{
				
				const query = client.query(new pg.Query("SELECT * from transaction order by email"))
				    query.on('row', (row) => {	//push all transactions database to data structure
					   allTransaction.push(row);
				    })
				    query.on('error', (res) => {	//error
					console.log(res);
				    })
				   query.on("end", function (result) {
					res.json({value:val, transactions:allTransaction, first_name: user.first_name, last_name: user.last_name, email: user.email});
					  
				    });

				    done()
				})
			}

		}else{
			res.json({value: 'Invalid Username and/or Password'});
		}
	}else{
			res.json({value: 'Invalid Username and/or Password'});
	}
});


app.post('/api/registerUser', (req, res) => {				//api for user registration

	const {first_name, last_name, email, password, customer} = req.body

	if( email && password){
		const exists = users.some(user => user.email.toLowerCase() === email.toLowerCase())
	
		if(!exists){			//if no user exists in db, create that user
			const user = {
				id: users.length + 1, 
				first_name,
				last_name, 
				email,
				password,
				customer
			}

			users.push(user)

			req.session.userId = user.id

			pool.query('INSERT INTO customer_info (password, last_name, id, first_name, email, customer) VALUES ($1, $2, $3, $4, $5, $6)', [user.password, user.last_name, user.id, user.first_name, user.email.toLowerCase(), user.customer], (error, results) => {
			    if (error) {
			      throw error
			    }
			  })

			res.send('Ok');
		}else{
			res.send('Email already in use');
		}
  	}else{
		res.send('Fail'); 
	  }
});


const mailOptions = {
  from: 'bankteam160@gmail.com', // sender address
  to: 'bankteam160@gmail.com', // list of receivers
  subject: 'Reset Your Password', // Subject line
  html: '<p>Your html here</p>'// plain text body
};
  
transporter.sendMail(mailOptions, function (err, info) {	//send the email
   if(err)
     console.log(err)
   else
     console.log(info);
});



// app.get('/home', redirectLogin, (req, res) => {

// 	const {user} = res.locals

// 	res.send(`

// 		<h1>Home</h1>
// 		<a href = '/'>Main</a>
// 		<ul>
// 			<li>Name: ${user.first_name}</li>
// 			<li>Email: ${user.email}</li>
// 		</ul>

// 	`)
// })


// app.get('/login', redirectHome, (req, res) => {

// 	res.send(`

// 		<h1>Login</h1>
// 		<form method='post' action='/login'>

// 			<input type='email' name='email' placeholder='Email' required />
// 			<input type='password' name='password' placeholder='Password' required />
// 			<input type = 'submit' />
// 		</form>
// 		<a href = '/register'>Register</a>

// 	`)
// })

// app.get('/register', redirectHome, (req, res) => {

// 	res.send(`

// 		<h1>Register</h1>
// 		<form method='post' action='/register'>
// 		<input name='first_name' placeholder='First Name' required />
// 		<input name='last_name' placeholder='Last Name' required />
// 		<input type='email' name='email' placeholder='Email' required />
// 		<input type='password' name='password' placeholder='Password' required />
// 		<select name="customer" id="customer">
// 	        <option value="No">I'm NOT a customer</option>
// 	        <option value="Yes">I'm a customer</option>
//     	</select>

// 		<input type = 'submit' />
// 		</form>
// 		<a href = '/login'>Login</a>


// 	`)
// })


// app.post('/login', redirectHome, (req, res) => {
// 	console.log('logging in');

// 	const{email, password} = req.body

// 	if(email && password){
// 		const user = users.find(user => user.email === email && user.password === password)

// 		if(user){
// 			req.session.userId = user.id
// 			return res.redirect('/home')
// 		}
// 	}

// 	res.redirect('/login')
// })


// app.post('/logout', redirectLogin, (req, res) => {

// 	req.session.destroy(err=> {
// 		if(err){
// 			return res.redirect('/home')
// 		}
// 		res.clearCookie(SESS_NAME)
// 		res.redirect('/login')
// 	})

// })


app.listen(PORT, () => console.log(`http://localhost'${PORT}`))

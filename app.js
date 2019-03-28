const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const cors = require('cors')
const TWO_HOURS = 1000 * 60 * 60 * 2

const app = express();
var pg = require("pg");			//postgres

app.use(cors());

const users = []			//holds user information from database and newly created users

var idCount = 0;			//everytime a new user registers an account, idCount increases by 1
var savingsAccountNumber = 100000;	//savingsAccountNumber starts at 100000 and is incremented each time an account of this type is opened
var checkingAccountNumber = 500000;	//checkingAccountNumber starts at 500000 and is incremented each time an account of this type is opened



var nodemailer = require('nodemailer');		//nodemailer for forgot my password
var transporter = nodemailer.createTransport({	//set bank credentials
 service: 'gmail',
 auth: {
        user: 'bankteam160@gmail.com',
        pass: 'Bankteam160cs'
    }
});

const mailOptions = {	         //mail structure for reset password
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


var connectionString = {		//connect to db
    host: 'ec2-54-221-243-211.compute-1.amazonaws.com',
    port: 5432,
    user: 'xmfxzigqqctouo',
    password: 'c32fb92ec8652dd3837ed8423fa1eef3938b939ddb06235b19150f883871a087',
    database: 'dbds5lgqf1gspn',
}

var pool = new pg.Pool(connectionString);

pool.connect(function(err, client, done) {

    const query = client.query(new pg.Query("SELECT * from customer_info"))
    query.on('row', (row) => {	//push data from database to data structure
	 users.push(row);
    })
    query.on('error', (res) => {	//error
        console.log(res);
    })
	
//     const queryT = client.query(new pg.Query("SELECT * from transaction"))	//transaction data push from database
//     queryT.on('row', (row) => {	//push data from database to data structure
// 	 userTransaction.push(row);
//     })
//     queryT.on('error', (res) => {	//error
//         console.log(res);
//     })

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
		//const allTransaction = []		//holds all transactions, this is for bank manager

		if(user){

			req.session.userId = user.id;
			
			let val = 'Valid Login' + user.customer; //1 represents customer, 0 represents manager

			if(user.customer === 1){	//if a customer, get only this customer's transactions
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
			
			}else{		//if bank manager, then give list of all transactions of all customers
				
				pool.connect(function(err, client, done) {
					    const query = client.query(new pg.Query("SELECT * from transaction order by email asc, date desc"))


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
			}
		}else{
			res.json({value: 'Invalid Username and/or Password'});
		}
	}else{
			res.json({value: 'Invalid Username and/or Password'});
	}
});


app.post('/api/registerUser', (req, res) => {				//api for user registration

	const {first_name, last_name, email, password, confirmPassword, customer} = req.body
	
	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;

	if( email && password){
		const exists = users.some(user => user.email.toLowerCase() === email.toLowerCase())
	
		if(!exists){			//if no user exists in db, create that user
			const user = {
				id: idCount + 1, 
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
			pool.query('INSERT INTO transaction (date, email, amount, balance) VALUES ($1, $2, $3, $4)', [date, user.email.toLowerCase(), 0, 0], (error, results) => {
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


app.post('/api/depositOrWithdraw', (req, res) => {	//api for deposit or withdrawal for a customer
	
	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;

	const {email, amount, balance} = req.body
	var total = balance + amount;
	
	if(total < 0){
		res.send("Not enough money to withdraw");
	}else{

		pool.query('INSERT INTO transaction (date, email, amount, balance) VALUES ($1, $2, $3, $4)', [date, email, amount, total], (error, results) => {
		    if (error) {
		      throw error
		    }
		})
	}
});

app.post('/api/balance', (req, res) => {	//api for getting balance of a customer

	const {email} = req.body
	
	const hold = [];		//holds balance
	
	pool.connect(function(err, client, done) {
	    const query = client.query(new pg.Query("SELECT balance from transaction where email=$1 order by date desc LIMIT 1", [email]))

	    query.on('row', (row) => {	//push transaction of user from database to data structure
		    hold.push(row);
	    })
	    query.on('error', (res) => {	//error
		console.log(res);
	    })
	   query.on("end", function (result) {
		res.json({balanceUser: hold});
	    });

	    done()
	})
	
});


app.post('/api/transferToAccount', (req, res) => {	//api for transferring funds from one account to another account

	const {emailFrom, emailTo, amount, balance} = req.body
	
	if(amount > balance){
		res.send("Error, not enough funds");	//if user doesn't have enough funds to transfer	
	}
	
	
	var found = false;				//boolean to check if emailTo user found
	
	for(var i = 0; i < users.length; i++){		//check if emailTo is a valid user
		if(users[i].email === emailTo && users[i].customer === 1){	//if valid emailTo customer found
			found = true;
			break;
		}
	}
	if(found === false){				//if emailTo customer not found
		res.send("Error, customer not found");
	}


	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;

	var total = balance - amount;	//emailFrom balannce
	
	var getBalance = 0;		//get the current balance from emailTo

	pool.query('INSERT INTO transaction (date, email, amount, balance) VALUES ($1, $2, $3, $4)', [date, emailTo, amount, getBalance], (error, results) => {
	    if (error) {
	      throw error
	    }
	})
	
	pool.query('INSERT INTO transaction (date, email, amount, balance) VALUES ($1, $2, $3, $4)', [date, emailFrom, amount, total], (error, results) => {
	    if (error) {
	      throw error
	    }
	})
	
	
	res.send("Ok");
	
});


app.post('/api/closeAccount', (req, res) => {	//api for closing bank account
	
	const {email, type} = req.body
	
	pool.query('UPDATE  customer_info where email=$1', [email], (error, results) => {	//remove user from customer_info table in database
	    if (error) {
	      throw error
	    }
	})	
	
	for(var i = 0; i < users.length; i++){	//remove user from array
		if(users[i].email === email){
			users.splice(i,1);
			break;
		}
	}
	
	res.send("Ok");
});





app.listen(PORT, () => console.log(`http://localhost'${PORT}`))

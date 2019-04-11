const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const cors = require('cors')
const TWO_HOURS = 1000 * 60 * 60 * 2

const app = express();
var pg = require("pg");			//postgres

app.use(cors());

global.users = []			//holds user information from database and newly created users

global.savingsAccountNumber = 100000;	//savingsAccountNumber starts at 100000 and is incremented each time an account of this type is opened
global.checkingAccountNumber = 500000;	//checkingAccountNumber starts at 500000 and is incremented each time an account of this type is opened


var nodemailer = require('nodemailer');		//nodemailer for forgot my password
var transporter = nodemailer.createTransport({	//set bank credentials
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


app.post('/api/validateUser', (req, res) => {			//api for validating user when signing in

	console.log('validateLogin called');

	const{email, password, customer} = req.body;

	if(email && password){
		const user = global.users.find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password);
		
		const specificTransaction = []		//holds user information from database and newly created users

		if(user){

			let val = 'Valid Login' + user.customer; //1 represents customer, 0 represents manager

			if(user.customer === 1){	//if a customer, get only this customer's transactions
				pool.connect(function(err, client, done) {
					    const query = client.query(new pg.Query("SELECT date_stamp, amount, balance from transactions where email=$1", [user.email]))

					    query.on('row', (row) => {	//push transaction of user from database to data structure
						 specificTransaction.push(row);
					    })
					    query.on('error', (res) => {	//error
						console.log(res);
					    })
					   query.on("end", function (result) {
					    });

					    done()
				})
				
				const accountArray = []		//holds savings and checking account info for user
				pool.connect(function(err, client, done) {		//checking and savings balance and account numbers get
					    const query = client.query(new pg.Query("SELECT * from bank_accounts where email=$1", [user.email]))

					    query.on('row', (row) => {	//push transaction of user from database to data structure
						    accountArray.push(row);
					    })
					    query.on('error', (res) => {	//error
						console.log(res);
					    })
					   query.on("end", function (result) {
						res.json({value:val, transactions:specificTransaction, first_name: user.first_name, last_name: user.last_name, email: user.email, address: user.address, zipcode: user.zipcode, accountInfo: accountArray});
					    });

					    done()
				})
				
			
			}else{		//if bank manager, then give list of all transactions of all customers
				
				pool.connect(function(err, client, done) {
					    const query = client.query(new pg.Query("SELECT * from transactions"))


					    query.on('row', (row) => {	//push transaction of user from database to data structure
						    specificTransaction.push(row);
					    })
					    query.on('error', (res) => {	//error
						console.log(res);
					    })
					   query.on("end", function (result) {
						res.json({value:val, transactions:specificTransaction, first_name: user.first_name, last_name: user.last_name, email: user.email, address: user.address, zipcode: user.zipcode});
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
	

	const {first_name, last_name, email, password, confirmPassword, customer, address, zipcode} = req.body
	
	if(password != confirmPassword){
		res.send("Passwords do not match");	
	}
	
	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var dateHold = year + "-" + month + "-" + day;

	if( email && password){
		const exists = global.users.some(user => user.email.toLowerCase() === email.toLowerCase())
	
		if(!exists){			//if no user exists in db, create that user
			const user = {
				first_name,
				last_name, 
				email,
				password,
				customer,
				address,
				zipcode
			}

			global.users.push(user)

			pool.query('INSERT INTO customer_info (password, last_name, first_name, email, customer, address, zipcode) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.password, user.last_name, user.first_name, user.email.toLowerCase(), user.customer, user.address, user.zipcode], (error, results) => {
			    if (error) {
			      throw error
			    }
			  })
			pool.query('INSERT INTO transactions (transaction_id, email, date_stamp, amount, balance, first_name, last_name) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)', [user.email.toLowerCase(), dateHold, 0, 0, user.first_name, user.last_name], (error, results) => {
			    if (error) {
			      throw error
			    }
			  })
			
			//first_name, last_name, email, account_number, status, balance, type
			//Initialize savings and checking accounts to closed and value of 0 
			pool.query('INSERT INTO bank_accounts (first_name, last_name, email, account_number, status, balance, type) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.first_name, user.last_name, user.email, global.savingsAccountNumber, 'Closed', 0 ,'savings'], (error, results) => {
			    if (error) {
			      throw error
			    }
			})
			pool.query('INSERT INTO bank_accounts (first_name, last_name, email, account_number, status, balance, type) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.first_name, user.last_name, user.email, global.checkingAccountNumber, 'Closed', 0 ,'checking'], (error, results) => {
			    if (error) {
			      throw error
			    }
			})
			
			//increment account numbers 
			global.checkingAccountNumber = global.checkingAccountNumber+1;
			global.savingsAccountNumber = global.savingsAccountNumber+1;
			
			res.send('Ok');
		}else{
			res.send('Email already in use');
		}
  	}else{
		res.send('Fail'); 
	  }
});


app.post('/api/depositChecking', (req, res) => {	//api for deposit into checking
	
	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;

	const {first_name, last_name, email, amount, balance} = req.body
	var total = balance + amount;	//add amount to users checking
	console.log('depositing');
	
	var statusHold= [];
	pool.connect(function(err, client, done)
	{
		const query = client.query(new pg.Query('SELECT status from bank_accounts where email=$1 AND type="checking"', [email]))

		query.on('row', (row) => {	//push transaction of user from database to data structure
			statusHold.push(row);
		})
		query.on('error', (res) => {	//error
			console.log(res);
		})
		query.on("end", function (result) {
			if(statusHold[0].status === 'Closed'){
				res.send("Error, checking is closed");
			}
			
		});

		done()
	})
	


	pool.query('INSERT INTO transactions (transaction_id, email, date_stamp, amount, balance, first_name, last_name) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)', [email, date, amount, total, first_name, last_name], (error, results) => {
	    if (error) {
	      throw error
	    }
	})

	//update balance of checking
	pool.query("UPDATE bank_accounts SET balance=$1 where email=$2 AND type='checking'", [total, email], (error, results) => {	
	    if (error) {
	      throw error
	    }
	})	
	
	/*pool.query('UPDATE customer_info SET balance=$1 where email=$2', [total, email], (error, results) => {	//remove user from customer_info table in database
	    if (error) {
	      throw error
	    }
	})*/
	
	res.send("Ok");
// 	const specificTransaction = [];
// 	pool.connect(function(err, client, done)
// 	{
// 		const query = client.query(new pg.Query("SELECT date_stamp, amount, balance from transactions where email=$1", [user.email]))

// 		query.on('row', (row) => {	//push transaction of user from database to data structure
// 			specificTransaction.push(row);
// 		})
// 		query.on('error', (res) => {	//error
// 			console.log(res);
// 		})
// 		query.on("end", function (result) {
// 			res.json({transactions : specificTransaction});
// 		});

// 		done()
// 	})
	//count = count+1;
});

app.post('/api/withdrawChecking', (req, res) => {	//api for withdrawing from checking
	console.log('withdrawing');
	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;

	const {first_name, last_name, email, amount, balance} = req.body
	var total = balance - amount;	//add amount to users checking
	
	
// 	var statusHold= [];
// 	pool.connect(function(err, client, done)
// 	{
// 		const query = client.query(new pg.Query('SELECT status from bank_accounts where email=$1 AND type="checking"', [email]))

// 		query.on('row', (row) => {	//push transaction of user from database to data structure
// 			statusHold.push(row);
// 		})
// 		query.on('error', (res) => {	//error
// 			console.log(res);
// 		})
// 		query.on("end", function (result) {
// 		});

// 		done()
// 	})
	
// 	if(statusHold[0].status === 'Closed'){
// 		res.send("Error, checking is closed");
// 	}
	
	if(total < 0){
		res.send("Error, not enough funds");	
	}else{
		pool.query('INSERT INTO transactions (transaction_id, email, date_stamp, amount, balance, first_name, last_name) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)', [email, date, amount, total, first_name, last_name], (error, results) => {
		    if (error) {
		      throw error
		    }
		})

		//update balance of checking
		pool.query("UPDATE bank_accounts SET balance=$1 where email=$2 AND type='checking'", [total, email], (error, results) => {	
		    if (error) {
		      throw error
		    }
		})	
		
// 		pool.query('UPDATE customer_info SET balance=$1 where email=$2', [total, email], (error, results) => {	//remove user from customer_info table in database
// 		    if (error) {
// 		      throw error
// 		    }
// 		})	
		
// 		const specificTransaction = [];
// 		pool.connect(function(err, client, done)
// 		{
// 		const query = client.query(new pg.Query("SELECT date_stamp, amount, balance from transactions where email=$1", [email]))

// 			query.on('row', (row) => {	//push transaction of user from database to data structure
// 				specificTransaction.push(row);
// 			})
// 			query.on('error', (res) => {	//error
// 				console.log(res);
// 			})
// 			query.on("end", function (result) {
// 				res.json({transactions : specificTransaction});
// 			});

// 			done()
// 		})
		res.send("Ok");
	}
});


app.post('/api/transferToInternal', (req, res) => {	//api for transferring funds from one checking account to another account (internal)

	const {emailFrom, emailTo, amount, balance} = req.body	//balance represents checking account of emailFrom
	
	if(amount > balance){
		res.send("Error, not enough funds");	//if emailFrom doesn't have enough funds to transfer	
	}
	
	var found = false;				//boolean to check if emailTo user found
	var fromFirstName = '';
	var fromLastName = '';
	var toFirstName = '';
	var toLastName = '';
	
	for(var i = 0; i < global.users.length; i++){		//check if emailTo is a valid user
		if(global.users[i].email === emailTo && global.users[i].customer === 1){	//if valid emailTo customer found
			found = true;
			toFirstName = global.users[i].first_name;
			toLastName = global.users[i].last_name;
			//break;
		}
		if(global.users[i].email === emailFrom){
			fromFirstName = global.users[i].first_name;
			fromLastName = global.users[i].last_name;
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

	var getBalance = 0;		//get the current balance from emailTo
	var data = [];
		
	client.query('SELECT * from bank_accounts where email=$1', [emailTo], (err, res) => {
	  if (err) {
	    console.log(err.stack);
	  } else {
	    data.push(res.rows[0]);
	  }
	})
	
	getBalance = data[0].balance;		//emailTo balance
	
	var balanceEmailTo = getBalance+amount;	//emailFrom balannce


	pool.query('INSERT INTO transactions (transaction_id, email, date_stamp, amount, balance, first_name, last_name) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)', [emailTo, date, amount, balanceEmailTo, toFirstName, toLastName], (error, results) => {
	    if (error) {
	      throw error
	    }
	})
	

	pool.query('INSERT INTO transactions (transaction_id, email, date_stamp, amount, balance, first_name, last_name) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)', [emailFrom, date, amount, balance-amount, fromFirstName, fromLastName], (error, results) => {
	    if (error) {
	      throw error
	    }
	})
	
	pool.query('UPDATE bank_accounts SET balance=$1 where email=$2 AND type="checking"', [balance-amount, emailFrom], (error, results) => {	//update checking of emailFrom
	    if (error) {
	      throw error
	    }
	})	
	
	pool.query('UPDATE bank_accounts SET balance=$1 where email=$2 AND type="checking"', [balanceEmailTo, emailTo], (error, results) => {	//update checking of emailTo
	    if (error) {
	      throw error
	    }
	})	
	
// 	pool.query('UPDATE customer_info SET balance=$1 where email=$2', [balance-amount, emailFrom], (error, results) => {	//remove user from customer_info table in database
// 	    if (error) {
// 	      throw error
// 	    }
// 	})	
	
// 	pool.query('UPDATE customer_info SET balance=$1 where email=$2', [balanceEmailTo, emailTo], (error, results) => {	//remove user from customer_info table in database
// 	    if (error) {
// 	      throw error
// 	    }
// 	})	
		
	res.send("Ok");
});


app.post('/api/transferToExternal', (req, res) => {	//api for transferring funds to external

	const {email, amount, balance} = req.body
	
	if(amount > balance){
		res.send("Error, not enough funds");	//if emailFrom doesn't have enough funds to transfer	
	}
	
	var total = balance - amount;			//frontend passing balance or db query?
	
	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;
	
	
	pool.query('INSERT INTO transactions (transaction_id, email, date_stamp, amount, balance, first_name, last_name) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)', [email, date, amount, total, fromFirstName, fromLastName], (error, results) => {
	    if (error) {
	      throw error
	    }
	})

	pool.query('UPDATE bank_accounts SET balance=$1 where email=$2 AND type="checking"', [total, email], (error, results) => {	//remove user from customer_info table in database
	    if (error) {
	      throw error
	    }
	})	
	
// 	pool.query('UPDATE customer_info SET balance=$1 where email=$2', [total, email], (error, results) => {	//remove user from customer_info table in database
// 	    if (error) {
// 	      throw error
// 	    }
// 	})	
	
	
	
	res.send("Ok");
	
});


//need to add it to the transaction table?
app.post('/api/transferSelf', (req, res) => {	//api to transfer from savings to checking or checking to savings for self

	const {email, accountFrom, accountTo, amount} = req.body

	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;

	var total = 0;
	
	var hold = [];
	
	pool.query('SELECT balance FROM bank_accounts where email =$1 AND type=$2)', [email, accountFrom], (error, results) => {
	    if (error) {
	      throw error
	    }else{
	      hold.push(results.rows);
	    }
	})
	
	pool.query('SELECT balance FROM bank_accounts where email =$1 AND type=$2)', [email, accountTo], (error, results) => {
	    if (error) {
	      throw error
	    }else{
	      hold.push(results.rows);
	    }
	})
	
	if(amount > hold[0]){ //accountFrom balance
		res.send("Error, not enough funds");
	}else{
		
		//first_name, last_name, email, account_number, status, balance, type
		pool.query('UPDATE bank_accounts SET balance=$1 where email=$2 AND type=$3', [hold[0]-amount,email, accountFrom], (error, results) => {	
		    if (error) {
		      throw error
		    }
		})
		
		pool.query('UPDATE bank_accounts SET balance=$1 where email=$2 AND type=$3', [hold[0]+amount,email, accountTo], (error, results) => {	
		    if (error) {
		      throw error
		    }
		})
		
		
		//update balance on customer info
		var balanceOfUser = [];
		pool.connect(function(err, client, done) {
		    const query = client.query(new pg.Query("SELECT balance from bank_accounts where email=$1 LIMIT 2", [email]))

		    query.on('row', (row) => {	//push transaction of user from database to data structure
			    balanceOfUser.push(row);
		    })
		    query.on('error', (res) => {	//error
			console.log(res);
		    })
		    done()
		})
		
		
// 		pool.query('UPDATE customer_info SET balance=$1 where email=$2', [balanceOfUser[0].balance, email], (error, results) => {	
// 		    if (error) {
// 		      throw error
// 		    }
// 		})
	}

	res.send("Ok");
});


//deposit a check
app.post('/api/depositCheque', (req, res) => 
{	
	
	var dateObj = new Date();
	var month = dateObj.getUTCMonth() + 1; //months from 1-12
	var day = dateObj.getUTCDate();
	var year = dateObj.getUTCFullYear();

	var date = year + "-" + month + "-" + day;

	const {email, first_name, last_name, amount, balance} = req.body;
	var total = balance + amount;
	
	pool.query('INSERT INTO transactions (transaction_id, email, date_stamp, amount, balance, first_name, last_name) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)', [email, date, amount, total, first_name, last_name], (error, results) => {
	    if (error) 
		{
	      throw error
	    }
	});
	
	pool.query('UPDATE bank_accounts SET balance=$1 where email=$2 AND type="checking"', [total,email], (error, results) => {	
	    if (error) {
	      throw error
	    }
	})
	
// 	pool.query('UPDATE customer_info SET balance=$1 where email=$2', [total,email], (error, results) => {	
// 	    if (error) {
// 	      throw error
// 	    }
// 	})
	
	//count = count+1;
});


app.post('/api/allBalance', (req, res) => {	//api for getting balance of a customers checking and savings account

	const {email} = req.body
	
	const hold = [];		//holds balance
	
	pool.connect(function(err, client, done) {
	    const query = client.query(new pg.Query("SELECT balance from bank_accounts where email=$1", [email]))

	    query.on('row', (row) => {	//push transaction of user from database to data structure
		    hold.push(row);
	    })
	    query.on('error', (res) => {	//error
		console.log(res);
	    })
	   query.on("end", function (result) {
		res.json({balanceUser: hold});	//should push two rows, checking and savings
	    });

	    done()
	})
	
});

app.post('/api/balanceAllUsers', (req, res) => {  //api for getting balance of all customers checking and savings account for bank manager

	const hold = [];		//holds balance
		
	pool.connect(function(err, client, done) {
	    const query = client.query(new pg.Query("SELECT * from bank_accounts"))

	    query.on('row', (row) => {	//push transaction of user from database to data structure
		    hold.push(row);
	    })
	    query.on('error', (res) => {	//error
		console.log(res);
	    })
	   query.on("end", function (result) {
		res.json({balanceUser: hold});	//should push two rows, checking and savings for each user
	    });

	    done()
	})
	
});



app.post('/api/closeAccount', (req, res) => {	//api for closing either a savings or checking bank account
	
	const {email, type} = req.body		//type represents savings or checking account
	

	pool.query('UPDATE bank_accounts SET status="Closed" where email=$1 AND type=$2', [email, type], (error, results) => {	
	    if (error) {
	      throw error
	    }
	})	
	
	res.send("Ok");
});


app.post('/api/openAccount', (req, res) => {	//api for opening either a savings or checking bank account
	
	const {email, type} = req.body		//type represents savings or checking account
	
	pool.query('UPDATE bank_accounts SET status="Open" where email=$1 AND type=$2', [email, type], (error, results) => {	//update status 
	    if (error) {
	      throw error
	    }
	})
	
	res.send("Ok");
});


app.post('/api/resetPassword', (req, res) => {
	
	const {email} = req.body;
	
	const user = global.users.find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password);
	
	if(user){
	
		const mailOptions = {	         //mail structure for reset password
		  from: 'bankteam160@gmail.com', // sender address
		  to: 'bankteam160@gmail.com',   // change receiver to email
		  subject: 'Reset Your Password', // Subject line
		  html: '<p>Your html here</p>'// plain text body
		};

		transporter.sendMail(mailOptions, function (err, info) {	//send the email
		   if(err)
		     console.log(err)
		   else
		     console.log(info);
		});
		
		res.send("Ok");
		
	}else{
		res.send("Error, email not found");	
	}

	
});


// app.listen(PORT, () => console.log(`http://localhost'${PORT}`))
app.listen(process.env.PORT || 3000, function(){
  console.log("Listening on port %d in %s mode", this.address().port, app.settings.env);
});

 

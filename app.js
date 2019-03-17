const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const TWO_HOURS = 1000 * 60 * 60 * 2

//const mysql = require('mysql');

const app = express();

const {Client} = require('pg')

const client = new Client({
	host: 'ec2-54-221-243-211.compute-1.amazonaws.com',
    port: 5432,
    user: 'xmfxzigqqctouo',
    password: 'c32fb92ec8652dd3837ed8423fa1eef3938b939ddb06235b19150f883871a087',
    database: 'dbds5lgqf1gspn'
})


client.connect()
.then(() => console.log("Connection successfuly"))
.then(()=>  client.query("select * from customer_info"))
.then(()=>  client.query("insert into  customer_info values ('pass', 'samm', 20, 'sam', 't@gmail.com', 1)"))
.then(results => console.table(results.rows))
.catch(e => console.log(e))
.finally(() => client.end())


const{
	PORT = 5000,
	NODE_ENV = 'development',
	SESS_NAME = 'sid',
	SESS_SECRET = 'ssh!quiet,it\'asecret!',
	SESS_LIFETIME = TWO_HOURS

}  = process.env

const IN_PROD = NODE_ENV === 'production'


const users = []		//holds information about all customers



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

app.post('/api/mydata', (req, res) => {

	console.log("called");
	var hold = req.session.userId;
	var trueEmail = '';
	for(var i = 0; i < users.length; i++){
		if(users[i].id === hold){
			trueEmail = users[i].email;
			break;
		}
	}
	// const d = [];
	// var query2 = client.query('SELECT * FROM transaction');
	// query2.on('result', function(row) {		//pushes all data from db to customers array
	// 	d.push(row);
	// });

	// res.send(d);

	res.send("hello")


	// var sql = "SELECT * FROM transaction where email = ?";
	// db.query(sql, trueEmail, function(err, rows, fields){});
	

});

app.post('/api/validateLogin', (req, res) => {
		console.log('validateLogin called');

		const{email, password, customer} = req.body;

		if(email && password)
		{
			const user = users.find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password);

			if(user)
			{

				req.session.userId = user.id;
				let val = 'Valid Login' + user.customer; //1 represents customer, 0 represents manager
				res.send(val);
			}
			else
			{
				res.send('Invalid Username and/or Password');
			}
		}
		else
			{
				res.send('Invalid Username and/or Password');
			}
});


app.post('/api/registerUser', (req, res) => {

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

			//store new user in db
			let post = {id:user.id, first_name: user.first_name, last_name: user.last_name, email: user.email.toLowerCase(), password:user.password, customer:user.customer};
			let sql = 'INSERT INTO customer_info SET ?';
			let query = client.query(sql, post, (err, result) => {
				if(err) throw err;
			});

			res.send('Ok');
		}else{
			res.send('Email already in use');
		}
  	}else{
		//console.log('fail');
		res.send('Fail'); 
	  }
	

});





app.get('/', (req, res) => {

	const{userId}  = req.session

	res.send(`

		<h1>Welcome!</h1>
		${userId ? `
		<a href ='/login'>Login</a>
		<a href = '/register'>Register</a>

		<a href = '/home'>Home</a>
		<form method = 'post' action = '/logout'>
			<button>Logout</button>
		</form>

		` : `
		<a href = '/login'>Login</a>
		<a href = '/register'>Register</a>

		`}

	`)

})

app.get('/home', redirectLogin, (req, res) => {

	const {user} = res.locals

	res.send(`

		<h1>Home</h1>
		<a href = '/'>Main</a>
		<ul>
			<li>Name: ${user.first_name}</li>
			<li>Email: ${user.email}</li>
		</ul>

	`)
})


app.get('/login', redirectHome, (req, res) => {

	res.send(`

		<h1>Login</h1>
		<form method='post' action='/login'>

			<input type='email' name='email' placeholder='Email' required />
			<input type='password' name='password' placeholder='Password' required />
			<input type = 'submit' />
		</form>
		<a href = '/register'>Register</a>

	`)
})

app.get('/register', redirectHome, (req, res) => {

	res.send(`

		<h1>Register</h1>
		<form method='post' action='/register'>
		<input name='first_name' placeholder='First Name' required />
		<input name='last_name' placeholder='Last Name' required />
		<input type='email' name='email' placeholder='Email' required />
		<input type='password' name='password' placeholder='Password' required />
		<select name="customer" id="customer">
	        <option value="No">I'm NOT a customer</option>
	        <option value="Yes">I'm a customer</option>
    	</select>

		<input type = 'submit' />
		</form>
		<a href = '/login'>Login</a>


	`)
})


app.post('/login', redirectHome, (req, res) => {
	console.log('logging in');

	const{email, password} = req.body

	if(email && password){
		const user = users.find(user => user.email === email && user.password === password)

		if(user){
			req.session.userId = user.id
			return res.redirect('/home')
		}
	}

	res.redirect('/login')
})


app.post('/logout', redirectLogin, (req, res) => {

	req.session.destroy(err=> {
		if(err){
			return res.redirect('/home')
		}
		res.clearCookie(SESS_NAME)
		res.redirect('/login')
	})

})


app.listen(PORT, () => console.log(`http://localhost'${PORT}`))

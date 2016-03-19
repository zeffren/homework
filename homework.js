
/* 
 * homework.js
 *
 * EDMODO HOMEWORK
 *
 * Design a homework submission web application Pick your favorite web framework to create this application. 
 * You are not required to create registration workflow and you can create the users in the database. 
 * To simplify authentication, the user can log in with only the username (i.e. no password). Please implement 
 * the following user stories: 
 * 	1. Homework contains a title, a question and a due date. You do not need to create the UI for homework creation. 
 * 	2. Teacher can assign a homework to multiple students. You do not need to create the UI for this. 
 * 	3. Student can see all assigned homework  (UI is required)
 * 	4. Student can submit a homework multiple times before the due date  (UI is required)
 * 	5. Teacher can see a list of latest submissions for a homework  (UI is required)
 * 	6. Teacher can see all submission versions for a student for a homework.  (UI is required)
 *
 * Instructions:
 *  1) from command line execute:
 *	  	> node --use_strict homework.js
 *  2) from browser open
 * 		http://localhost:8080
 *
 * author: zeffren zarate
 * date: 03/15/2016
 */
var http = require('http');
var url = require('url');
var path = require('path');
var request = require('request');
var express = require("express");
var bodyParser = require("body-parser");
var moment = require("moment");



class Persisted {

	constructor() {
		this.id = getId();
	}

}

class Versioned extends Persisted {

	constructor() {
		super();
		this.version = 1;
	}

}

class User extends Persisted {

	constructor( name, teacher ) {
		super();
		this.name = name;
		this.teacher = teacher || false;
	}
}

class Homework extends Persisted {

	constructor( title, question ) {

		super();
		this.title = title;
		this.question = question;
	}

}

class Assignment extends Versioned {

	constructor( teacher, student, homework, due ) {

		super();
		this.teacher = teacher;
		this.student = student;
		this.homework = homework;
		this.due = due || null;
	}

}





/*
 * Returns new unique identifier 
 * (poor man's UID but sufficiently unique for our purposes)
 */
function getId() {

	var time = Date.now();
	var rand = Math.floor(Math.random() * 1000);

	return (time * 1000) + rand;
}




// Define our "database"
// (for purposes of this exercise we define an in-memory representation of dataset
// but in practices this would probably be some persistent representation)
var db = {};

(function () {

	var today = moment().hour( 23 ).minute( 59 ).second( 59 ).millisecond( 999 ).format();
	var tomorrow = moment( today ).add( 1, 'days' ).format();
	var yesterday = moment( today ).add( -1, 'days' ).format();
	var twoDaysAgo = moment( today ).add( -2, 'days' ).format();
	var nextWeek = moment( today ).add( 7, 'days' ).format();

	var zeffren = new User( "zeffren" );
	var bartsimpson = new User( "bartsimpson" );
	var aristotle = new User( "aristotle", true );
	var demosthenes = new User( "demosthenes", true );
	var herodotus = new User( "herodotus", true );

	db.users = [
		zeffren,
		bartsimpson,
		aristotle,
		demosthenes,
		herodotus
	];

	var mathHomework = new Homework( "Math","Solve Fib(5)" );
	var englishHomework = new Homework( "English","What did the tell tale heart tell us?" );
	var historyHomework = new Homework( "History","What is manifest about our destiny?" );

	var bartAssignment = new Assignment( aristotle, bartsimpson, mathHomework, tomorrow );
	bartAssignment.answer = "Don't have a cow man.";
	bartAssignment.submitted = today;

	var historyAssignment = new Assignment( herodotus, zeffren, historyHomework, yesterday );
	historyAssignment.answer = "carpe diem";
	historyAssignment.submitted = twoDaysAgo;

	db.assignments = [
		new Assignment( aristotle, zeffren, mathHomework, tomorrow ),
		bartAssignment,
		new Assignment( demosthenes, zeffren, englishHomework, tomorrow ),
		historyAssignment
	];

})();


/*
 * Get user by username
 */
function getUser( name ) {

	if( db.users ) {

		for( var i = 0; i < db.users.length; i++ ) {

			var user = db.users[i];

			if( user.name.toUpperCase() == name.toUpperCase() ) {
				return user;
			}
		}
	}

	return null;
}

/*
 * Retrieve assignments based on argument criteria.
 * (assumes either retrieving by specific assignment ID, or by user.
 * if retreiving by teacher then will confirm that assignment submitted)
 */
function getAssignments( criteria ) {

	var results = [];


	if( db.assignments ) {

		for( var i = 0; i < db.assignments.length; i++ ) {

			var assignment = db.assignments[i];

			if( criteria.id ) {

				if( assignment.id == criteria.id ) {

					results.push( assignment );
				}
			}
			else if( criteria.username ) {

				var user = getUser( criteria.username );

				if( assignment.student.name == criteria.username  ) {
					results.push( assignment );
				}
				else if( user.teacher == true && assignment.teacher.name == criteria.username && assignment.submitted != null ) {

					results.push( assignment );
				}
			}
		}
	}

	return results;
}


/*
 * Retrieve archived assignments based on argument criteria and return sorted by version.
 * (In practice this is retrieving/grouping by the assignment.id)
 */
function getArchive( criteria ) {

	var results = [];

	if( db.archive ) {

		for( var i = 0; i < db.archive.length; i++ ) {

			var assignment = db.archive[i];

			if( criteria.id ) {

				if( assignment.id == criteria.id ) {

					results.push( assignment );
				}
			}
		}
	}

	// sort descending
	results.sort( function(a,b) {
    	return b.version - a.version;
	});


	//console.log( results );

	return results;		
}

/*
 * version and archive argument assignment
 */
function version( assignment ) {

  	// version
	var versioned = Object.assign( new Assignment(), assignment );
	//console.log( "versioned: " + JSON.stringify( versioned ) );

	db.archive = db.archive || [];
	db.archive.push( versioned );

	assignment.version = assignment.version + 1;

	return assignment;
}


// define our application API
var app = express();
app.use( bodyParser.urlencoded({ extended: false }) );
app.use( bodyParser.json() );
app.listen( 8080, function() {
  console.log("Started on PORT 8080");
});


/*
 * Default GET action returns client view described by index.html
 */
app.get('/',function(req,res){
  res.sendFile( path.resolve("./index.html") );
});


/*
 * Get user (used in authentication)
 */
app.get(/^\/user/,function(req,res){

	//console.log('GET ' + req.url );

	var results = [];

	if( req.query.username ) {

		var name = req.query.username;
		//console.log("username=" + name );

		var user = getUser( name );
		results = [ user ];
	}

	res.json( results );
});


/*
 * retrieve assignements for argument user (assumes access controlled behavior)
 */
app.get(/^\/assignment/,function(req,res){

	//console.log('GET ' + req.url );

	var results = [];

	if( req.query.username ) {

		var username = req.query.username;
		//console.log("USER=" + username );

		// filter assignments based on argument criteria
		results = getAssignments( { username: username } );
	}

	res.json( results );
});


/*
 * Update assignment. Operation will automactially version and archive.
 */
app.put( '/assignment', function( req, res ){
  
  	//console.log("POST " + req.url );

  	var response;
  	if( req.body.assignment ) {
  		
  		var assignment = JSON.parse( req.body.assignment );
  		//console.log( "GOT: " + assignment.id );

  		var current = getAssignments( { id: assignment.id } )[0];

  		// if previously submitted then auto-version
  		if( current.submitted ) {
  			current = version( current );
  		}

  		current.answer = assignment.answer;
  		current.submitted = assignment.submitted;

		response = current;

		var current = getAssignments( { id: assignment.id } )[0];


		console.log( assignment.student.name + " submitted: " + assignment.homework.title + " " + assignment.submitted );
  	}

	res.json( [ response ] );	
	

});


/*
 * Retrieve archived assignments
 */
app.get(/^\/archive/,function(req,res){

	//console.log('GET ' + req.url );

	var results = [];

	if( req.query.id ) {

		var id = req.query.id;
		results = getArchive( { id: id } );
	}

	res.json( results );
});





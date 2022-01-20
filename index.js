const prompts = require('prompts');
const {
  red,
	bgRed,
} = require('kolorist')
const fs=require('fs');

if (!fs.existsSync('champ.db')){
	fs.writeFileSync('champ.db', '');
}

var sqlite3 = require('sqlite3').verbose();
let db=new sqlite3.Database('./champ.db',(err)=>{
	if (err) {
		console.error(red(err.message))
	}

	main();
});

async function main(){

	db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, win INTEGER, lose INTEGER, winrate REAL)');


	while(true){
		let result=await loop()
		if (result=='break'){
			break
		}
	}

}

async function loop(){
	const response = await prompts({
		type: 'select',
		name: 'value',
		message: 'What do you want to do?',
		choices: [
			{ title: 'Record a match',  value: 0 },
			{ title: 'Check Leaderboard',  value: 1 },
			{ title: 'Add a new player', value: 2},
			{ title: bgRed('Quit'), value: 3}
		],
		initial: 0
	})

	if (response.value==0){
		await recordMatch()
	}else if (response.value==1){
		await showLeaderboard()
	}else if (response.value==2){
		await addPlayer()
	}else if (response.value==3){

		db.close((err) => {
			if (err) {
				console.error(err.message)
			}

			process.exit()
		})

		return 'break'
	}else{
		console.error('Invalid input')
	}

}

async function recordMatch(){
	return new Promise(async(resolve,reject)=>{
		const sql='SELECT * FROM users ORDER BY id ASC'

		db.all(sql,async (err,rows)=>{
			if (err){
				console.error(red(err.message))
				resolve(false)
				return
			}

			if (rows.length==0){
				let response = await prompts({
					type: 'confirm',
					name: 'value',
					message: 'Database is empty. Create a new player first!',
					initial: true
				})

				resolve(false)
				return
					
			}

			const response = await prompts({
				type: 'select',
				name: 'value',
				message: 'Who won?',
				choices: rows.map((row)=>{
					return {
						title: row.name,
						value: row.id
					}
				}),
				initial: 0
			})

			if (!response.value){
				resolve(false)
				console.error(red('Unexpected Input'))
				return
			}

			let winner=rows.filter(row=>row.id==response.value)[0]

			const response2 = await prompts({
				type: 'select',
				name: 'value',
				message: 'Who lost?',
				choices: rows.map((row)=>{
					return {
						title: row.name,
						value: row.id
					}
				}),
				initial: 0
			})

			if (!response2.value){
				resolve(false)
				console.error(red('Unexpected Input'))
				return
			}

			let loser=rows.filter(row=>row.id==response2.value)[0]

			if (winner.id==loser.id){
				console.error(red('You can not play against yourself'))
				resolve(false)
				return
			}

			const response3 = await prompts({
				type: 'toggle',
				name: 'value',
				message: `Are you sure you want to record ${winner.name} as winner and ${loser.name} as loser?`,
				initial: true,
				active: 'yes',
				inactive: 'no'
			})

			if (!response3.value){
				console.log(red('Aborted'))
				resolve(false)
			}
			
			// update winner win rate
			fillNull(winner)
			fillNull(loser)

			winner.win+=1
			loser.lose+=1

			winner.winrate=((winner.win/(winner.win+winner.lose))*100).toFixed(1)
			loser.winrate=((loser.win/(loser.win+loser.lose))*100).toFixed(1)

			const sql2='UPDATE users SET win=?, lose=?, winrate=? WHERE id=?'
			db.run(sql2,[winner.win,winner.lose,winner.winrate,winner.id])
			db.run(sql2,[loser.win,loser.lose,loser.winrate,loser.id])

			resolve(true)
			
		})

	})
}

function fillNull(user){
	if (!user.win){
		user.win=0
	}
	if (!user.lose){
		user.lose=0
	}

	return user
}

async function showLeaderboard(){
	const sql='SELECT * FROM users ORDER BY winrate DESC'
	return new Promise((resolve,reject)=>{
		db.all(sql,async (err,rows)=>{
			if (err){
				console.error(red(err.message))
				resolve(false)
				return
			}

			if (rows.length==0){
				let response = await prompts({
					type: 'confirm',
					name: 'value',
					message: 'Database is empty. Create a new player first!',
					initial: true
				})
				resolve(false)
				return		
			}

			rows.sort((a,b)=>{
				if (b.winrate!=a.winrate){
					return b.winrate-a.winrate
				}else{
					return b.win-a.win
				}
			})

			console.table(rows)
	
			const response = await prompts({
				type: 'confirm',
				name: 'value',
				message: 'Do you want to go back?',
				initial: true
			})

			resolve(true)
		})

	})
	
}

async function addPlayer(){
	const response = await prompts({
		type: 'text',
		name: 'value',
		message: `What's the name of the new player?`
	})

	if (!response.value){
		console.error(red('You must enter a name'))
		return
	}

	db.run('INSERT INTO users (name) VALUES (?)',[response.value],(err)=>{
		if (err) {
			console.error(red(err.message))
		}
	})
}
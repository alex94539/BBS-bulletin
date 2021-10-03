const net = require('net');
const mongodb = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017/test';
const fs = require('fs');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');


let clients = {};
let lastId = -1;
let _db;
let _userInfo;
let _board;
let _posts;
let _postIndex;
let _boardIndex;
let _mails;

//setInterval(() => {console.log('Halt check.')}, 5000)

//console.log(moment('2020-04-07', 'YYYY-MM-DD').format('MM/DD'));

mongodb.connect(url, (err, db) => {
    if(err) throw err;
    
    _db = db.db('test');
    _userInfo = _db.collection('userInfo');
    _board = _db.collection('board');
    _posts = _db.collection('posts');
    _postIndex = _db.collection('postIndex');
    _boardIndex = _db.collection('boardIndex');
    _mails = _db.collection('mails');
    //_buckets = _db.collection('buckets');
    _postIndex.find({}).toArray((err, result) => {
        //console.log(result);
    });
    const server = net.createServer(socketHandler);
    //const subServer = net.createServer(subSocket);
    server.listen(23);
    
});

function subSocket(socket){

}


function socketHandler(socket){
    let id, firstdata = -1;
    lastId++;
    clients[lastId] = {
        socket: socket,
        unFinisnedCommand: []
    };
    id = lastId;
    console.log('new connection');
    socket.write(JSON.stringify({msg: '********************************\n** Welcome to the BBS server. **\n********************************\n% ',code: 200}))
    

    let status = {
        isLoggedIn: false,
        currentUser: undefined,
        currentBucket: undefined
    }
    socket.on("data", function(data) {
        
        //if(! ++firstdata) return;
        let char = Buffer.from(data);
        //console.log(char);
        let toWrite = char.toString();
        //console.log(toWrite);
        //toWrite = toWrite.replace(/\r\n|\n|\r/g,'');
        commandHandler(socket, toWrite, status);
        

    });

    socket.on("end", function() {
        clients[id].socket.end();
        delete clients[id];
    });
}

function commandHandler(socket, data, status){
    let keyword;
    let sliced = data.split(' ');
    //console.log(sliced);
    let userInfo = fs.readFileSync('./userInfo.json');
    userInfo = JSON.parse(userInfo);
    switch (sliced[0]){
        case 'register':
            if(sliced.length == 1 || (!sliced[1] || !sliced[2] || !sliced[3])){
                socket.write(JSON.stringify({msg: 'Usage: register <username> <email> <password>\n% ', code: 200}));
            }
            else{
                _userInfo.find({username: sliced[1]}).toArray((err, result) => {
                    if(!result.length){
                        let tempBucket = '0613313-' + sliced[1].toLowerCase() + '-' + uuidv4()
                        _userInfo.insertOne({
                            username: sliced[1],
                            email: sliced[2],
                            password: sliced[3],
                            bucket: tempBucket,
                            nextMailIndex: 1
                        }, function(err, result) {
                            if(err) throw err;
                            socket.write(JSON.stringify({
                                msg: '', 
                                code: 205, 
                                bucketName: tempBucket, 
                                OP: 'createBucket', 
                                username: sliced[1]
                            }));
                        });
                    }
                    else{                        
                        socket.write(JSON.stringify({msg: 'Username is already used.\n% ', code: 200}));
                    }
                });
                /*
                if(!sliced[0] || !sliced[2] || !sliced[3]){

                }
                else if(sliced[1] in userInfo){
                    socket.write('Username is already used.\n');
                }
                else{
                    userInfo[sliced[1]] = {
                        password: sliced[3],
                        email: sliced[2]
                    }
                    socket.write('Register successfully.\n');
                    fs.writeFileSync('./userInfo.json', JSON.stringify(userInfo));
                }
                */
            }
            break;
        case 'login':
            if(sliced.length == 1 || !sliced[1] || !sliced[2]){
                socket.write(JSON.stringify({msg: 'Usage: login <username> <password>\n% ', code: 200}));
            }
            else if(status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please logout first.\n% ', code: 200}));
            }
            else{
                _userInfo.find({username: sliced[1], password: sliced[2]}).toArray((err, result) => {
                    if(!result.length){
                        socket.write(JSON.stringify({msg: 'Login failed.\n% ', code: 200}));
                    }
                    else{
                        status.isLoggedIn = true;
                        status.currentUser = sliced[1];
                        //console.log(status.currentUser);
                        status.currentBucket = result[0].bucket;
                        //console.log(status.currentBucket);
                        socket.write(JSON.stringify({
                            msg: `Welcome, ${status.currentUser}.\n% `, 
                            code: 205, 
                            OP: 'recordData', 
                            username: sliced[1], 
                            bucketName: result[0].bucket
                        })
                        );
                    }

                })
                /*
                if(sliced[1] in userInfo 
                && sliced[2] == userInfo[sliced[1]].password){
                    status.isLoggedIn = true;
                    status.currentUser = sliced[1];
                    socket.write(`Welcome, ${status.currentUser}.\n`);
                }
                else{
                    socket.write('Login failed.\n');
                }
                */
            }
            break;
        case 'logout':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({
                    msg: 'Please login first.\n% ',
                    code: 200
                }));
            }
            else{
                socket.write(JSON.stringify({
                    msg: `Bye, ${status.currentUser}.\n% `,
                    code: 205,
                    OP: 'recordDelete'
                }));
                status.isLoggedIn = false;
                status.currentUser = undefined;
            }
            break;
        case 'whoami':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
            }
            else{
                socket.write(JSON.stringify({msg: `${status.currentUser}\n% `, code: 200}));
            }
            break;
        case 'create-board':
            if(sliced.length == 1 || !sliced[1]){
                socket.write(JSON.stringify({msg: 'Usage: create-board <name>\n% ', code: 200}));
            }
            else if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
            }
            else{
                _board.find({name: sliced[1]}).toArray((err, result) => {
                    if(!result.length){
                        _boardIndex.find().toArray((err, result) => {
                            let newBoardID = result[0].nextIndex;
                            _board.insertOne({name: sliced[1], Moderator: status.currentUser, Index: newBoardID},function(err, result) {
                                if(err) throw err;
                                socket.write(JSON.stringify({
                                    msg: 'Create board successfully.\n% ',
                                    code: 200,
                                }));
                            });
                            _db.createCollection(sliced[1]);
                            _boardIndex.updateOne({'nextIndex': newBoardID}, {$set: {'nextIndex': ++newBoardID}})
                        });
                        
                    }
                    else{
                        socket.write(JSON.stringify({msg: 'Board is already exist.\n% ', code: 200}));
                    }
                })

            }
            break;
        case 'create-post': //not finished
            let title = data.match(/--title (.*) --content/);
            let content = data.match(/--content (.*)/);
            if(!title || !content || !title[1] || !content[1]){
                socket.write(JSON.stringify({msg: 'Usage: create-post <board-name> --title <title> --content <content>.\n% ', code: 200}));
                break;
            }
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
                break;
            }
            _board.find({name: sliced[1]}).toArray((err, result) => {
                if(!result.length){
                    socket.write(JSON.stringify({msg: 'Board does not exist.\n% ', code: 200}));
                }
                else{
                    _postIndex.find().toArray((err, result) => {
                        let newPostID = result[0].nextIndex;
                        _db.collection(sliced[1]).insertOne({ //save metadata at db
                            postID: newPostID,
                            title: title[1],
                            createdAt: moment().format('YYYY-MM-DD'),
                            createdBy: status.currentUser,
                            atBucket: status.currentBucket
                        }, function(err, result){
                            _posts.insertOne({ //save post position
                                postID: newPostID,
                                at: sliced[1],
                                atBucket: status.currentBucket
                            });
                            socket.write(JSON.stringify({ //tell client to create file
                                msg: '', 
                                code: 205, 
                                OP: 'createPost',
                                title: title[1],
                                content: content[1],
                                atBoard: sliced[1],
                                postID: newPostID,
                                createdAt: moment().format('YYYY-MM-DD'),
                                createdBy: status.currentUser,
                                comments: []
                            }));
                            _postIndex.updateOne({'nextIndex': newPostID}, {$set: {'nextIndex': ++newPostID}});

                        });
                        
                    });
                    
                }
            });
            
            break;

        case 'list-board':
            //if(!status.isLoggedIn){
            //    socket.write('Please login first.\n% ');
            //    break;
            //}
            keyword = data.match(/ ##(.*)/);
            if(!keyword){
                _board.find({}).toArray((err, result) => {
                    let str = 'Index\tName\tModerator\n';
                    for(let l=0;l<result.length;l++){
                        str = str + `${result[l].Index}\t${result[l].name}\t${result[l].Moderator}\n`;
                    }
                    str = str + '% ';
                    socket.write(JSON.stringify({msg: str, code: 200}));
                });
            }
            else{
                let temp = new RegExp(keyword[1], "g");
                _board.find({name: temp}).toArray((err, result) => {
                    let str = 'Index\tName\tModerator\n';
                    for(let l=0;l<result.length;l++){
                        str += (`${result[l].Index}\t${result[l].name}\t${result[l].Moderator}\n`);
                    }
                    str += '% ';
                    socket.write(JSON.stringify({msg: str, code: 200}));
                });
            }
            break;

        case 'list-post':
            //if(!status.isLoggedIn){
            //    socket.write('Please login first.\n% ');
            //    break;
            //}
            if(!sliced[1]){
                socket.write(JSON.stringify({msg: 'Usage: list-post <board-name> ##<key>\n% ', code: 200}));
                break;
            }
            keyword = data.match(/ ##(.*)/);
            _board.find({name: sliced[1]}).toArray((err, re) => {
                if(!re.length){
                    socket.write(JSON.stringify({msg: 'Board dose not exist.\n% ', code: 200}));
                }
                else{
                    if(!keyword){
                        let tempstr = '';
                        _db.collection(sliced[1]).find({}).toArray((err, result) => {
                            if(!result.length){
                                tempstr = ('ID\tTitle\tAuthor\tDate\n% ');

                            }
                            else{
                                tempstr += ('ID\tTitle\tAuthor\tDate\n');
                                for(let h=0;h<result.length;h++){
                                    tempstr += `${result[h].postID}\t${result[h].title}\t${result[h].createdBy}\t${result[h].createdAt}\n`;
                                }
                                tempstr += '% ';
                            }
                            socket.write(JSON.stringify({msg: tempstr, code: 200}));
                        });
                    }
                    else{
                        let tempstr = '';
                        let temp = new RegExp(keyword[1]);
                        _db.collection(sliced[1]).find({title: temp}).toArray((err, result) => {
                            if(!result.length){
                                tempstr = ('ID\tTitle\tAuthor\tDate\n% ');

                            }
                            else{
                                tempstr += ('ID\tTitle\tAuthor\tDate\n');
                                for(let h=0;h<result.length;h++){
                                    tempstr += `${result[h].postID}\t${result[h].title}\t${result[h].createdBy}\t${result[h].createdAt}\n`;
                                }
                                tempstr += '% ';
                            }
                            socket.write(JSON.stringify({msg: tempstr, code: 200}));
                        });
                    }
                }
            })
            
            break;
        case 'read':
            if(!sliced[1]){
                socket.write(JSON.stringify({msg: 'Usage: read <post-id>\n% ', code: 200}));
                break;
            }
            _posts.find({postID: Number(sliced[1])}).toArray((err, result) => {
                if(!result.length){
                    socket.write(JSON.stringify({msg: 'Post is not exist.\n% ', code: 200}));
                }
                else{
                    let at = result[0].at;
                    let atBucket = result[0].atBucket;
                    //console.log(at);
                    socket.write(JSON.stringify({
                        msg: '', 
                        code: 203, 
                        atBucket: atBucket, 
                        postID: Number(sliced[1]), 
                        OP: 'readPost'}))
                    
                }
            });
            break;
        case 'delete-post':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
                break;
            }
            if(!sliced[1]){
                socket.write(JSON.stringify({msg: 'Usage: delete-post <post-id>\n% ', code: 200}));
            }
            else{
                _posts.find({postID: Number(sliced[1])}).toArray((err, result) => {
                    if(!result.length){
                        socket.write(JSON.stringify({msg: 'Post is not exist.\n% ', code: 200}));
                    }
                    else{
                        let at = result[0].at;
                        let atBucket = result[0].atBucket;
                        _db.collection(at).find({postID: Number(sliced[1])}).toArray((err, res) => {
                            if(res[0].createdBy != status.currentUser){
                                socket.write(JSON.stringify({msg: 'Not the post owner.\n% ', code: 200}));
                            }
                            else{
                                _db.collection(at).deleteOne({postID: Number(sliced[1])});
                                _posts.deleteOne({postID: Number(sliced[1])});
                                socket.write(JSON.stringify({
                                    msg: '',
                                    OP: 'deletePost',
                                    atBucket: atBucket,
                                    postID: Number(sliced[1]),
                                    code: 205
                                }));
                            }
                        });
                    }
                });
            }
            break;
        case 'update-post':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
            }
            let toBeUpdated = data.match(/(--title|--content) (.*)/);
            if(!sliced[1] || !toBeUpdated){
                socket.write(JSON.stringify({msg: 'Usage: update-post <post-id> --title/content <new>\n% ', code: 200}));
            }
            else{
                _posts.find({postID: Number(sliced[1])}).toArray((err, result) => {
                    if(!result.length){
                        socket.write(JSON.stringify({msg: 'Post is not exist.\n% ', code: 200}));
                    }
                    else{
                        let at = result[0].at;
                        let toUpdateObj;
                        if(toBeUpdated[1] == '--title'){
                            toUpdateObj = {
                                title: toBeUpdated[2]
                            }
                        }
                        
                        _db.collection(at).find({postID: Number(sliced[1])}).toArray((err, res) => {
                            if(res[0].createdBy != status.currentUser){
                                socket.write(JSON.stringify({msg: 'Not the post owner.\n% ', code: 200}));
                            }
                            else{
                                if(toBeUpdated[1] == '--title'){
                                    _db.collection(at).updateOne({postID: Number(sliced[1])}, {$set: toUpdateObj});
                                    socket.write(JSON.stringify({
                                        msg: '',
                                        atBucket: result[0].atBucket,
                                        OP: 'updateTitle',
                                        title: toBeUpdated[2],
                                        postID: Number(sliced[1]),
                                        code: 205
                                    }));
                                }
                                else{
                                    socket.write(JSON.stringify({
                                        msg: '',
                                        atBucket: result[0].atBucket,
                                        OP: 'updateContent',
                                        content: toBeUpdated[2],
                                        postID: Number(sliced[1]),
                                        code: 205
                                    }));
                                }
                            }
                        });
                    }
                });
            }
            break;
        case 'comment':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
                break;
            }
            
            if(!sliced[1] || !data.match(/\d+ (.*)/)){
                socket.write(JSON.stringify({msg: 'Usage: comment <post-id> <comment> \n% ', code: 200}));
            }
            else{
                _posts.find({postID: Number(sliced[1])}).toArray((err, result) => {
                    if(!result.length){
                        socket.write(JSON.stringify({msg: 'Post is not exist.\n% ', code: 200}));
                    }
                    else{
                        socket.write(JSON.stringify({
                            msg: '',
                            postID: Number(sliced[1]),
                            code: 205,
                            atBucket: result[0].atBucket,
                            commentContent: data.match(/\d+ (.*)/)[1],
                            OP: 'comment'
                        }))
                    }
                });
            }
            break;
        case 'mail-to':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
                break;
            }
            let mailSubject = data.match(/--subject (.*) --content/);
            let mailContent = data.match(/--content (.*)/);
            if(!sliced[1] || !mailSubject || !mailContent || !mailSubject[1] || !mailContent[1]){
                socket.write(JSON.stringify({msg: 'Usage: mail-to <username> --subject <subject> --content <content>\n% ', code: 200}));
                break;
            }

            _userInfo.find({username: sliced[1]}).toArray((err, result) => {
                if(!result.length){
                    socket.write(JSON.stringify({msg: `${sliced[1]} does not exist.\n% `, code: 200}))
                }
                else{
                    _mails.insertOne({
                        mailIndex: result[0].nextMailIndex,
                        from: status.currentUser,
                        to: sliced[1],
                        subject: mailSubject[1],
                        sendAt: moment().format('MM/DD'),
                        atBucket: result[0].bucket
                    })
                    socket.write(JSON.stringify({
                        msg: '',
                        OP: 'createMail',
                        sendTo: result[0].bucket,
                        subject: mailSubject[1],
                        content: mailContent[1],
                        mailIndex: result[0].nextMailIndex,
                        date: moment().format('YYYY-MM-DD'),
                        code: 205
                    }));
                    _userInfo.updateOne({_id: result[0]._id}, {$set: {nextMailIndex: ++(result[0].nextMailIndex)}})
                }
            });
            break;
        case 'list-mail':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
                break;
            }

            _mails.find({to: status.currentUser}).toArray((err, result) => {
                let tempstr = 'ID\tSubject\tFrom\tDate\n';
                result.forEach((element) => {
                    tempstr += `${element.mailIndex}\t${element.subject}\t${element.from}\t${element.sendAt}\n`;
                });
                tempstr += '% ';
                socket.write(JSON.stringify({msg: tempstr, code: 200}));
            });
            break;
        case 'retr-mail':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
                break;
            }
            if(!sliced[1]){
                socket.write(JSON.stringify({msg: 'Usage: retr-mail <mail##>\n% ', code: 200}));
                break;
            }
            _mails.find({to: status.currentUser, mailIndex: Number(sliced[1])}).toArray((err, result) => {
                if(!result.length){
                    socket.write(JSON.stringify({msg: 'No such mail.\n% ', code: 200}));
                }
                else{
                    socket.write(JSON.stringify({
                        msg: '',
                        code: 205,
                        OP: 'readMail',
                        mailIndex: sliced[1]
                    }));
                }
            });
            break;
        case 'delete-mail':
            if(!status.isLoggedIn){
                socket.write(JSON.stringify({msg: 'Please login first.\n% ', code: 200}));
                break;
            }
            if(!sliced[1]){
                socket.write(JSON.stringify({msg: 'Usage: delete-mail <mail##>\n% ', code: 200}));
                break;
            }
            _mails.find({to: status.currentUser, mailIndex: Number(sliced[1])}).toArray((err, result) => {
                if(!result.length){
                    socket.write(JSON.stringify({msg: 'No such mail.\n% ', code: 200}));
                }
                else{
                    _mails.deleteOne({to: status.currentUser, mailIndex: Number(sliced[1])});
                    socket.write(JSON.stringify({
                        msg: '',
                        OP: 'deleteMail',
                        code: 205,
                        mailIndex: Number(sliced[1])
                    }));
                }
            });
            break;
        case 'exit':
            socket.destroy();
            break;
        default:
            socket.write(JSON.stringify({msg: '% ', code: 200}));
            break;
    }
}


//[-]{2}\w+
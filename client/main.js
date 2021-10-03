const net = require('net');
const readline = require('readline');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
//200 command success AND not further operation to do
//203 readpost Only //current
//205 command success AND more operation to do //more operation in OP
//403 command not success
let status = {
    currentBucket: undefined,
    currentUser: undefined
}
const client = new net.Socket();
const subclient = new net.Socket();
let read = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

client.connect(23, 'localhost', (err, result) => {
    if(err) throw err;
    console.log('Connected.');
    //client.write('Connected.');
});

client.on('data', (data) => {
    
    let str = (Buffer.from(data)).toString();

    
    str = JSON.parse(str);
    if(str.code == 200){
        read.question(str.msg, (answer) => {
            answer = answer.toString().trim();
            client.write(answer);
        });
    }
    else if(str.code == 203) {
        clientHandler(client,str);
        read.question('', (answer) => {
            answer = answer.toString().trim()
            client.write(answer);
        });
    }
    else if(str.code == 205) {
        read.question(str.msg, (answer) => {
            answer = answer.toString().trim();
            client.write(answer);
        });
        clientHandler(client, str);
    }
    else if(str.code == 403){
        read.question(str.msg + '\n% ', answer => {
            answer = answer.toString().trim();
            client.write(answer);
        })
    }
});

client.on('close', () => {

    console.log('Connection closed by foreign host.');
    process.exit(1);
})

function clientHandler(socket, str){
    //console.log(str);
    switch(str.OP){
        case 'recordData': 
            status.currentUser = str.username;
            status.currentBucket = str.bucketName;
            //console.log(status.currretBucket, status.currentUser);
            break;
        case 'createBucket': 
            //status.currentUser = str.username;
            //status.currretBucket = str.bucketName;
            s3.createBucket({
                Bucket: str.bucketName,
                ACL: 'public-read-write'
            }, (result) => {
                process.stdout.write('Register successfully.\n% ');
                    //console.log(result);
            });
            break;
        case 'createPost':
            //console.log(str, status.currentBucket);
            let postParam = {
                Bucket: status.currentBucket,
                Key: `posts/${str.postID}`,
                Body: JSON.stringify({
                    title: str.title,
                    content: str.content,
                    createdAt: str.createdAt,
                    createdBy: str.createdBy,
                    atBoard: str.atBoard,
                    postID: str.postID,
                    comments: []
                })
            };
            let post = s3.putObject(postParam).promise();
            post.then(data => {
                process.stdout.write('Create post successfully.\n% ');
                //console.log(data);
            });
            break;
        case 'createMail':
            let mailParam = {
                Bucket: str.sendTo,
                Key: `mails/${str.mailIndex}`,
                Body: JSON.stringify({
                    content: str.content,
                    subject: str.subject,
                    date: str.date,
                    from: status.currentUser
                })
            }
            let mail = s3.putObject(mailParam).promise();
            mail.then(data => {
                process.stdout.write('Sent successfully.\n% ');
            });
            break;
        
        case 'recordDelete':
            status.currentUser = undefined;
            status.currentBucket = undefined;
            break;
        case 'readPost': 
            let readParam = {
                Bucket: str.atBucket,
                Key: `posts/${str.postID}`
            }
            s3.getObject(readParam, (err, data) => {
                if(err) throw err;
                let content = JSON.parse(Buffer.from(data.Body).toString())
                //console.log(content);
                let text = content.content.replace(/<br>/g, '\n');
                let article = '';
                article += `Author:\t${content.createdBy}\n`;
                article += `Title:\t${content.title}\n`;
                article += `Date:\t${content.createdAt}\n`;
                article += `--\n${text}\n--\n`;
                for(let j=0;j<content.comments.length;j++){
                    article += `${content.comments[j].commentBy}: ${content.comments[j].commentContent}\n`;
                }
                article += '% ';
                process.stdout.write(article);
            });
            break;
        case 'deletePost':
            let deleteParam = {
                Bucket: status.currentBucket,
                Key: `posts/${str.postID}`
            }
            s3.deleteObject(deleteParam, (err, data) => {
                if(err) throw err;
                process.stdout.write('Delete successfully.\n% ');
            });
            break;
        case 'updateTitle':
            let upTitleParam = {
                Bucket: status.currentBucket,
                Key: `posts/${str.postID}`
            }
            s3.getObject(upTitleParam, (err, data) => {
                let content = JSON.parse(Buffer.from(data.Body).toString());
                s3.putObject({
                    Bucket: status.currentBucket,
                    Key: `posts/${str.postID}`,
                    Body: JSON.stringify({
                        title: str.title,
                        content: content.content,
                        createdAt: content.createdAt,
                        postID: content.postID,
                        comments: content.comments,
                        createdBy: content.createdBy
                    })
                }, (err, putdata) => {
                    process.stdout.write('Update successfully.\n% ');
                })
            });
            break;
        case 'updateContent':
            let upContParam = {
                Bucket: status.currentBucket,
                Key: `posts/${str.postID}`
            }
            s3.getObject(upContParam, (err, data) => {
                let content = JSON.parse(Buffer.from(data.Body).toString());
                s3.putObject({
                    Bucket: status.currentBucket,
                    Key: `posts/${str.postID}`,
                    Body: JSON.stringify({
                        title: content.title,
                        content: str.content,
                        createdAt: content.createdAt,
                        postID: content.postID,
                        comments: content.comments,
                        createdBy: content.createdBy
                    })
                }, (err, putdata) => {
                    process.stdout.write('Update successfully.\n% ');
                })
            });
            break;
        case 'comment':
            let commentParam = {
                Bucket: str.atBucket,
                Key: `posts/${str.postID}`
            }
            s3.getObject(commentParam, (err, data) => {
                let content = JSON.parse(Buffer.from(data.Body).toString());
                //console.log(content.comments)
                content.comments.push({
                    commentBy: status.currentUser,
                    commentContent: str.commentContent
                });
                //console.log(newcomment);
                s3.putObject({
                    Bucket: str.atBucket,
                    Key: `posts/${str.postID}`,
                    Body: JSON.stringify({
                        title: content.title,
                        content: content.content,
                        createdAt: content.createdAt,
                        postID: content.postID,
                        comments: content.comments,
                        createdBy: content.createdBy
                    })
                }, (err, putdata) => {
                    process.stdout.write('Comment successfully.\n% ');
                    //console.log(err, putdata)
                })
            });
            break;
        case 'readMail':
            let readMailParam = {
                Bucket: status.currentBucket,
                Key: `mails/${str.mailIndex}`
            }
            //console.log(readMailParam);
            s3.getObject(readMailParam, (err, data) => {
                let content = JSON.parse(Buffer.from(data.Body).toString());
                let tempstr = `Subject\t: ${content.subject}\nFrom\t: ${content.from}\nDate\t: ${content.date}\n`;
                let newcontent = content.content.replace(/<br>/g, '\n');
                tempstr += `--\n${newcontent}\n% `;
                process.stdout.write(tempstr);
            });
            break;
        case 'deleteMail':
            let deleteMailParam = {
                Bucket: status.currentBucket,
                Key: `mails/${str.mailIndex}`,
            }
            //console.log(deleteMailParam)
            s3.deleteObject(deleteMailParam, (err, data) => {
                if(err) throw err;
                //let content = JSON.parse(Buffer.from(data.Body).toString());
                process.stdout.write('Mail deleted.\n% ');
            });
            break;
    }
}
/**
 * JSON.stringify({
                    title: str.title,
                    content: str.content,
                    createdAt: str.createdAt,
                    atBoard: str.atBoard,
                    postID: str.postID,
                    comments: str.comments
                })
 */
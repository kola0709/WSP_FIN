const express = require('express');
const ejs = require('ejs');
const app = express();
const port = 6594;
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');


const connection = mysql.createConnection({
    host : 'localhost',
    user : 'root',
    password : '',
    database : 'final'
});

connection.connect();

app.set('view engine', 'ejs')
app.set('views', './ejs')

app.use(bodyParser.urlencoded({extended: false}))
app.use(express.json());

app.use(session( {secret: 'kdh0709', cookie: {maxAge: 60000000000000000000000000000000000}, resave: true, saveUninitialized: true} ))

app.use(express.static(path.join(__dirname, 'img')))
app.use(express.static(path.join(__dirname, 'static')))

app.use((req, res, next) => {
    res.locals.username="",
    res.locals.user_pri_key=""

    if(req.session.member)
    {
        res.locals.username = req.session.member.username;
        res.locals.user_pri_key = req.session.member.user_pri_key;
    }
    next()
});

app.listen(port, () => {
    console.log(`listening on ${port}`)
});

//---------------------------------------------------------------------------------메인페이지----------------------------------------------------------------------------------

app.get('/', (req, res) => {
    const sql_getPosts = `SELECT id, username, LEFT(title, 10) AS truncated_title, LEFT(content, 20) AS truncated_content, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS formatted_created_at 
    FROM posts 
    ORDER BY created_at DESC
    limit 5`;

    // 추가된 부분: 모든 글의 개수를 가져오는 SQL 쿼리
    const sql_getTotalPostsCount = `SELECT COUNT(*) AS totalPosts FROM posts`;

    connection.query(sql_getPosts, (err, posts) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Err');
            return;
        }

        // 추가된 부분: 글의 개수를 가져오고 렌더링 시 전달
        connection.query(sql_getTotalPostsCount, (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).send('Internal Server Err');
                return;
            }

            const totalPostsCount = results[0].totalPosts;

            res.render('main', { posts: posts, totalPostsCount: totalPostsCount });
        });
    });
});


//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//로그인, 로그아웃, 회원가입

app.get('/login', (req, res) => {
    res.render('login')
});

app.post('/loginProc', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    var sql_login = `select * from users where username=? and password=?`

    var values = [username, password];

    connection.query(sql_login, values, function (err, result) {
        if(err) throw err;

        if(result.length == 0) {
            res.send("<script> alert('아이디 혹은 비밀번호가 잘못되었습니다.'); location.href='/login'; </script>")
        }
        else {
            req.session.member = {
                ...result[0],
            };
            res.send("<script> alert('로그인 성공'); location.href='/'; </script>")
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.member = null;
    res.send("<script> alert('로그아웃 성공'); location.href='/'; </script>")
});

app.get('/register', (req, res) => {
    res.render('register')
});

app.post('/registerProc', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;

    var sql_register = `insert into users(username, password, email)
    values('${username}', '${password}', '${email}')`

    connection.query(sql_register, function (err, result) {
        if(err) throw err;
        console.log('user update');
        res.send("<script> alert('회원가입이 완료되었습니다.'); location.href='/' </script>");
    })
});

app.get('/edit_profile', (req, res) => {
    const userId = req.session.member.user_pri_key;
    
    const user_data_query = `select * from users where user_pri_key = ?`;

    connection.query(user_data_query, [userId], (err, result) => {
        if(err) {
            console.error(err);
            res.status(500).send('internal server err');
            return;
        }

        const user = result[0];
        res.render('edit_profile', {user});
    });
});

app.post('/edit_profile_proc', (req, res) => {
    const userId = req.session.member.user_pri_key ;
    const new_id = req.body.new_id;
    const new_email = req.body.new_email;
    const new_pw = req.body.new_pw;

    connection.query('select * from users where user_pri_key = ?', [userId], (err, result) => {
        if(err) {
            console.error(err);
            res.status(500).send('internal server error');
            return;
        }

        const user = result[0];

        const update_profile_query = `update users set username = ?, email =?, password = ? where user_pri_key = ?`;

        connection.query(update_profile_query, [new_id, new_email, new_pw, userId], (err, result) => {
            if(err) {
                console.error(err);
                res.status(500).send('internal server error');
                return;
            }
            
            res.send("<script> alert('사용자 정보 업데이트가 완료되었습니다. 로그아웃 이후 다시 로그인해주시길 바랍니다.'); location.href='/' </script>");
        })
    })
})
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//포스트 작성, 확인, 수정
app.get('/write_post', (req, res) => {
    res.render('write_post')
});

app.post('/postingProc', (req, res) => {
    const title = req.body.title;
    const content = req.body.content;
    const username = req.session.member.username;
    const user_pri_key = req.session.member.user_pri_key;

    var sql_posting =`insert into posts(username, title, content, user_pri_key)
    values('${username}', '${title}', '${content}', '${user_pri_key}')`

    connection.query(sql_posting, function (err, result) {
        if(err) throw err;
        console.log('posting complete');
        res.send("<script> alert('글 작성이 완료되었습니다.'); location.href='/' </script>")
    })
});

app.post('/comment', (req, res) => {
    const { comment, postId } = req.body;
    const { user_pri_key } = res.locals;

    // 새로운 쿼리를 추가하여 현재 로그인한 사용자의 username을 가져옴
    const getUsernameQuery = 'SELECT username FROM users WHERE user_pri_key = ?';

    connection.query(getUsernameQuery, [user_pri_key], (error, userResults) => {
        if (error) {
            console.error(error);
            res.status(500).send('Internal Server Error', error);
            return;
        }

        if (userResults.length === 0) {
            res.status(404).send('사용자를 찾을 수 없음');
            return;
        }

        const username = userResults[0].username;

        // 댓글 추가 쿼리
        const insertCommentQuery = 'INSERT INTO comments (post_id, user_id, username, content) VALUES (?, ?, ?, ?)';
        const values = [postId, user_pri_key, username, comment];

        connection.query(insertCommentQuery, values, (error, results) => {
            if (error) {
                console.error(error);
                res.status(500).send('Internal Server Error', error);
                return;
            }

            res.redirect(`/view_post/${postId}`);
        });
    });
});

app.get('/view_post/:postId', (req, res) => {
    const postId = parseInt(req.params.postId);

    const selectPostQuery = `SELECT id, username, title, content, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS formatted_created_at FROM posts WHERE id = ?`;
    const selectCommentsQuery = `
        SELECT comments.user_id, comments.content, DATE_FORMAT(comments.created_at, '%Y-%m-%d %H:%i:%s') AS formatted_created_at, users.username
        FROM comments
        JOIN users ON comments.user_id = users.user_pri_key
        WHERE comments.post_id = ?`;

    connection.query(selectPostQuery, [postId], (error, postResults) => {
        if (error) {
            console.error(error);
            res.status(500).send('내부 서버 오류', error);
            return;
        }

        if (postResults.length === 0) {
            res.status(404).send('게시물을 찾을 수 없음');
            return;
        }

        const post = postResults[0];

        connection.query(selectCommentsQuery, [postId], (error, commentsResults) => {
            if (error) {
                console.error(error);
                res.status(500).send('내부 서버 오류', error);
                return;
            }

            const comments = commentsResults.map(comment => ({
                username: comment.username,
                content: comment.content,
                formatted_created_at: comment.formatted_created_at
            }));

            res.render('view_post', { post, comments });
        });
    });
});

app.get('/edit_post/:postId', (req, res) => {
    const postId = parseInt(req.params.postId);

    const sql_getPostById = `SELECT id, username, title, content, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS formatted_created_at FROM posts WHERE id = ?`;

    connection.query(sql_getPostById, [postId], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Err', err);
            return;
        }

        if (results.length === 0) {
            res.status(404).send('게시물을 찾을 수 없음');
            return;
        }

        const post = results[0];
        res.render('edit_post', { post: post });
    });
});

app.post('/edit_post_Proc', (req, res) => {
    const post_id = req.body.id;
    const new_title = req.body.new_title;
    const new_content = req.body.new_content;

    console.log(post_id);

    const edit_post_query = `update posts set title = ?, content = ? where id = ?`;

    connection.query(edit_post_query, [new_title, new_content, post_id], (err, result) => {
        if(err) {
            console.error(err);
            res.status(500).send('internal server err');
            return;
        }

        res.send("<script> alert('개시글이 수정되었습니다.'); location.href='/myPosts' </script>");
    })
});

app.post('/delete_post', (req, res) => {
    const postId = req.body.id;

    if(!postId) {
        res.status(400).send("잘못된 요청 : postid가 필요합니다.");
        return;
    }

    const sql_delete_post = `delete from posts where id = ?`;

    connection.query(sql_delete_post, [postId], (err, result) => {
        if(err) {
            console.error(err);
            res.status(500).send('internal server err');
            return;
        }

        if(result.affectedRows > 0) {
            res.redirect('/myPosts');
        }
        else {
            res.status(400).send("글을 찾을 수 없습니다.");
        }
    })
})

app.get('/view_all_post', (req, res) => {
    let searchQuery = req.query.search || '';

    let sql_getPosts = `
        SELECT id, username, LEFT(title, 10) AS truncated_title, LEFT(content, 20) AS truncated_content, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS formatted_created_at 
        FROM posts`;

    let sql_countPosts = `
        SELECT COUNT(*) AS totalPosts
        FROM posts`;

    if (searchQuery) {
        sql_getPosts += `
            WHERE username LIKE '%${searchQuery}%' OR
                  title LIKE '%${searchQuery}%' OR
                  content LIKE '%${searchQuery}%'`;

        sql_countPosts += `
            WHERE username LIKE '%${searchQuery}%' OR
                  title LIKE '%${searchQuery}%' OR
                  content LIKE '%${searchQuery}%'`;
    }

    connection.query(sql_countPosts, (err, countResult) => {
        if (err) {
            console.error(err);
            res.status(500).send('내부 서버 오류');
            return;
        }

        const totalPosts = countResult[0].totalPosts;

        sql_getPosts += `
            ORDER BY created_at DESC`;

        connection.query(sql_getPosts, (err, posts) => {
            if (err) {
                console.error(err);
                res.status(500).send('내부 서버 오류');
                return;
            }

            res.render('view_all_post', { posts: posts, searchQuery: searchQuery, totalPosts: totalPosts });
        });
    });
});

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//개인 개시글 확인

app.get('/myPosts', (req, res) => {
    const loginUser = req.session.member ? req.session.member.user_pri_key : null;
    console.log(loginUser)

    const qurey_my_post = `SELECT id, username, LEFT(title, 10) AS truncated_title, LEFT(content, 20) AS truncated_content, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS formatted_created_at 
    FROM posts 
    WHERE user_pri_key = ?
    order by created_at desc`;

    connection.query(qurey_my_post, [loginUser], (err, result) => {
        if(err) throw err;
        res.render('myPosts', {posts: result});
    });
});

app.get('/intro', (req, res) => {
    res.render('introduce');
});

app.get('/author', (req, res) => {
    res.render('made_by');
});
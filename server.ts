import server, {router} from "server"
import {json} from "server/reply";



const { get, post } = router;


// Launch server with options and a couple of routes
server({ port: 8080 }, [
    get('/games', ctx => "0"),
    get('/event', ctx => {
        return json([["181362052618571776","abc123",true,true,true,0,1720000,0,0,0,0,0,0],[[181366223440106496,"abc123",0,1.72,20.5],[181364121967538176,"abc123",60278,3.54,0.0],[181366223440105728,"abc123",0,2.06,20.5],[181364121967538688,"abc123",0,1.31,0.0]]])
    })
]);
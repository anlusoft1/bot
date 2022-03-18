// 2 bilpack
// https://github.com/jontewks/puppeteer-heroku-buildpack
// heroku/nodejs
const { Client,List, Buttons } = require('whatsapp-web.js');
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const puppeteer = require("puppeteer");
const express = require("express");

const app = express();
app.set("port", process.env.PORT || 5000);
let configuracion =[];
let data_1 =[];
let data_2 =[];
let conversaciones =[];
var evento_error = {};
// TAXI https://script.google.com/macros/s/AKfycbx9fV2m9TXKMQFeXo70nEW23efskDwogApSx1OlyVBVTuZL1r8/exec
// PEDIDOD  https://script.google.com/macros/s/AKfycbx2q48P15JTo2D-Eu02K4ztO9saEYS7oF3uwU3eM8pupCVDJeo/exec
// COMEDERO https://script.google.com/macros/s/AKfycbwnO1lKwx6u_LXY94WJKsnVPHWUfobeDopUMqQpdrt5k8uCw_E/exec
var url_notificacion=process.env.URL_APP_SHEET||"https://script.google.com/macros/s/AKfycbwnO1lKwx6u_LXY94WJKsnVPHWUfobeDopUMqQpdrt5k8uCw_E/exec";
// DEJAR PRENDIDO SERVER
setInterval(echotest, 300000);

//app.set("port", 9101);
app.use(express.json())

let client = null;
console.log("EMPEZO START");

async function inicializar() {
    console.log("INGRESO");
    const browserP = puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],headless: true
      });    
    var browserWSEndpointP = await (await browserP).wsEndpoint();
    client = new Client({ puppeteer: { browserWSEndpoint:browserWSEndpointP}}); 
    console.log("TERMINO");

    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        console.log('QR RECEIVED', qr);
        (async () => {
            var response_end=  await axios.post(url_notificacion,{"op":"qr","qr":qr}).then((res) => {
                    return getStandardResponsePost(0, "OK",res.data);   
            }).catch(err => {
                    return getStandardResponsePost(1, err,{});   
            });
            console.log(JSON.stringify(response_end));
        })()
        .catch()
        .finally()
        ;
    
    });
    
    client.on(`authenticated`, (session) => {
        console.log('AUTHENTICATED', session);
    });
    
    client.on('ready', () => {
        console.log('Client is ready!');
        (async () => {
                var response_end=  await axios.post(url_notificacion,{"op":"conversacion"}).then((res) => {
                        return getStandardResponsePost(0, "OK",res.data);   
                }).catch(err => {
                        return getStandardResponsePost(1, err,{});   
                });
                configuracion=response_end.data.content; 
                // SI NO EXISTE SE PONE NULL
                data_1=response_end.data.data_1;                
                data_2=response_end.data.data_2;                
                for (let i = 0; i < configuracion.length; i++) {                    
                    for (let j = 0; j < configuracion[i].salida.length; j++) {
                        if(configuracion[i].salida[j].type==="url"){
                            var nombre_archivo = (configuracion[i].salida[j].mensaje).substring( (configuracion[i].salida[j].mensaje).lastIndexOf("/") + "/".length , (configuracion[i].salida[j].mensaje).length );
                            var response_axios =  await axios.get(configuracion[i].salida[j].mensaje, {
                                responseType: 'arraybuffer'
                                }).then((res) => {
                                    var mimetype = res.headers['content-type'];
                                    if(mimetype.includes(";")){
                                        mimetype=mimetype.split(";")[0];
                                    }    
                                    const buffer = Buffer.from(res.data, 'binary').toString('base64');
                                    return getStandardResponsePost(0, "OK",{base:buffer,type:mimetype}); 
                            }).catch(err => {
                                    return getStandardResponsePost(1, err,{});   
                            });
                            if(response_axios.code==0){
                                configuracion[i].salida[j].nombrearchivo=nombre_archivo;
                                configuracion[i].salida[j].base=response_axios.data.base;
                                configuracion[i].salida[j].mimetype=response_axios.data.type;
                            }
                        }        
                    }
                }

                console.log(JSON.stringify(configuracion));
                evento_error=configuracion.find((item) => item.evento === "Error"); 
        })()
        .catch()
        .finally()
        ;
    });
    
    client.on('message', msg => {
        (async () => {
        try
            {
                console.log("INGRESO MENSAJE MESSAGE");
                console.log(msg);
                var mensaje_recibido = "";
                var documento_recibido = {};
                if(msg.type !== undefined && msg.type=="document"){ 
                    var media_document = await msg.downloadMedia();
                    documento_recibido.mimetype=media_document.mimetype;
                    documento_recibido.filename=media_document.filename;
                    documento_recibido.data=media_document.data;
                    mensaje_recibido="documento_send"
                }else if(msg.type !== undefined && msg.type=="location"){
                    documento_recibido.latitud=msg.location.latitude;
                    documento_recibido.longitud=msg.location.longitude;
                    mensaje_recibido="ubicacion_send"
                }else{
                    mensaje_recibido=msg.body;
                }   
                var evento = configuracion.find((item) => item.entrada.split(";").includes(mensaje_recibido)); 
                console.log("EVENTO EN BASE AL MSJ"+ evento);
                // CASO EL EVENTO NO EXISTA SE BUSCAR EL RETORNANR en base al ultimo registro.
                if(evento===undefined){
                    evento = evento_error;
                    for (let il = conversaciones.length-1; il >= 0; il--) {
                        if(conversaciones[il].numero===msg.from){
                            if(conversaciones[il].evento=="ListaPedido"){ // NO FROMA PARTE DEL CALCULO
                                continue;
                            }
                            console.log("SE INICIA FOR CONVERSACION "+ JSON.stringify(conversaciones[il]));
                            var evento_retornar = configuracion.find((item) => conversaciones[il].retornar!="" && item.evento === conversaciones[il].retornar); 
                            if(evento_retornar!==undefined){
                                evento = evento_retornar;
                            }else{
                                // CASO SEAN MENU OPCIONES
                                var evento_retorna_arreglo_menu =conversaciones[il].retornar.split(";");
                                console.log("SE BUSCAR MENU EVENTOS SIN MENU RETORNO"+ evento_retorna_arreglo_menu);
                                if(evento_retorna_arreglo_menu.length>1){
                                    for (let jl = 0; jl < evento_retorna_arreglo_menu.length; jl++) {
                                        var evento_msj =evento_retorna_arreglo_menu[jl].split(",");
                                        if((evento_msj[1]+"")===(""+mensaje_recibido)){
                                            var evento_retornar_menu = configuracion.find((item) => item.evento === evento_msj[0]); 
                                            if(evento_retornar_menu!==undefined){
                                                evento = evento_retornar_menu;
                                                break;
                                            }
                                        }        
                                    }    
                                }    
                            }    
                            break;   
                        }
                    }      
    
                }
                // SE AGREGA EL EVENTO  A LA CONVESACION
                var conversacion_ingresado ={numero:msg.from,mensaje:mensaje_recibido,evento:evento.evento,retornar:evento.retornar,documento:documento_recibido};
                conversaciones.push(conversacion_ingresado);
          
    //            console.log(evento);
                var flagclean = "0";
                for (let il = 0; il < evento.salida.length; il++) {

                    var mensaje_end="";
                    // PEDIDOD
                    if (evento.salida[il].type!=="details" && il === 0){ // SOLO ENVIAMOS AL SERVER POSICION 0 END
                        if(evento.evento==="EndSolicitarPedido" || evento.evento==="EndRequestOrder"){
                            // se invoca a AXIOS
                                let result_details = conversaciones.filter(item => item.numero ===msg.from);
                                var param_evento_end = {"op":"notificar","numero":msg.from,"pedido":result_details};
                                var response_end=  await axios.post(url_notificacion,param_evento_end).then((res) => {
                                        return getStandardResponsePost(0, "OK",res.data);   
                                }).catch(err => {
                                        return getStandardResponsePost(1, err,{});   
                                });
                                mensaje_end=response_end.data.codigoventa;
                        }else if(evento.evento==="EndConsultaPedido" || evento.evento==="EndQueryOrder"){
                                var param_evento_end = {"op":"buscar","codigo":mensaje_recibido,"evento":evento.evento};
                                var response_end=  await axios.post(url_notificacion,param_evento_end).then((res) => {
                                        return getStandardResponsePost(0, "OK",res.data);   
                                }).catch(err => {
                                        return getStandardResponsePost(1, err,{});   
                                });
                                console.log(JSON.stringify(response_end));
                                mensaje_end=response_end.data.message;
                        }else if(evento.evento.includes("End")){
                            // TAXXI 
                            let result_details = conversaciones.filter(item => item.numero ===msg.from);
                            var response_end=  await axios.post(url_notificacion,
                                {"op":"end_conversacion","numero":msg.from,"conversacion":result_details}).then((res) => {
                                    return getStandardResponsePost(0, "OK",res.data);   
                            }).catch(err => {
                                    return getStandardResponsePost(1, err,{});   
                            });
                            console.log(JSON.stringify(response_end));
                            mensaje_end=response_end.data.message;
                            if(response_end.data.flagclean){
                                flagclean=response_end.data.flagclean;
                            }
                        }
                    }    
                   //TAXI
                    console.log(evento.salida[il]);
                    var listado = [];                  
                    if(evento.salida[il].type==="mensaje"){
                        await client.sendMessage(msg.from,evento.salida[il].mensaje+mensaje_end).then((r) => {
                        }).catch(err => {
                            console.log("ERROR EVENTO ", err);
                        });       
                    }else if(evento.salida[il].type==="details"){
                        var mensaje_details = evento.salida[il].mensaje+"\n";   
                        var detalle_subproducto = new Array("","","","","","","","","","","","","","","","","","","","","","","","","","","","");// SE INCIALIZA EN VACIO
                        for (let ill = 0; ill < evento.salida[il].lista.length; ill++) {
                            let result_details = conversaciones.filter(item => item.numero ===msg.from && item.evento===evento.salida[il].lista[ill].evento);
                            for (let ilm = 0 ; ilm < result_details.length; ilm++) {
                                detalle_subproducto[ilm]= detalle_subproducto[ilm]+result_details[ilm].mensaje+""+evento.salida[il].lista[ill].submensaje+ " ";
                            }
                        }
                        for (let ill = 0; ill < detalle_subproducto.length; ill++) {
                            if(detalle_subproducto[ill]===""){
                                break;
                            }
                            mensaje_details+= detalle_subproducto[ill].replace('\n', ' ')+"\n"; 
                        }
                        // SOLO PARA CASOS DONDE EXISTE UN DETALLE DE PEDIDOS SUBCALCULADOS
                        conversaciones.push({numero:msg.from,mensaje:mensaje_details,evento:"ListaPedido",retornar:"",documento:documento_recibido});          
                        await client.sendMessage(msg.from,mensaje_details).then((r) => {
      //                      console.log("SEND EVENTO",r);
                        }).catch(err => {
                            console.log("ERROR EVENTO ", err);
                        });       
                    }else if(evento.salida[il].type==="lista"){
                        let sections = [{title:evento.salida[il].mensaje,rows:[]}];
                        if(evento.salida[il].lista.length>0){
                            listado=evento.salida[il].lista;
                        }else if(evento.salida[il].data==="data_1") {   
                            listado=data_1;
                        }else if(evento.salida[il].data==="data_2") {  
                            listado=data_2;
                        }
                        for (let ill = 0; ill < listado.length; ill++) {
                            sections[0].rows.push({title:listado[ill].mensaje,description:listado[ill].submensaje});
                        }
                        let list = new List(evento.salida[il].mensaje+mensaje_end,evento.salida[il].submensaje,sections,null,null);
                        await client.sendMessage(msg.from,list).then((r) => {
    //                        console.log("SEND MENSAJEE",r);
                        }).catch(err => {
                            console.log("ERROR MENSAJE ", err);
                        });
                    }else if(evento.salida[il].type==="boton"){
                        var evento_boton =[];
                        if(evento.salida[il].lista.length>0){
                            listado=evento.salida[il].lista;
                        }else if(evento.salida[il].data==="data_1") {   
                            listado=data_1;
                        }else if(evento.salida[il].data==="data_2") {  
                            listado=data_2;
                        }
                        for (let ill = 0; ill < listado.length; ill++) {
                            evento_boton.push({body:listado[ill].mensaje});
                        }
                        let button = new Buttons(evento.salida[il].mensaje+mensaje_end,evento_boton,null,null);
                        await client.sendMessage(msg.from,button).then((r) => {
                            console.log("SEND MENSAJEE",r);
                        }).catch(err => {
                            console.log("ERROR MENSAJE ", err);
                        });
                    }else if(evento.salida[il].type==="url"){
                        var media = new MessageMedia(
                            evento.salida[il].mimetype, 
                            evento.salida[il].base,evento.salida[il].nombrearchivo
                            );
                            await client.sendMessage(msg.from,media).then((r) => {
                                console.log("SEND MENSAJE",r);
                            }).catch(err => {
                                console.log("ERROR MENSAJE ", err);
                            });                           
                    }
    
                }
                // SE PONER LOS MENSJAES
                console.log("EVENTO"+evento.evento);
                if(evento.evento==="Start" || flagclean==="1"){
                    var  result_numero = conversaciones.filter(item => item.numero !==msg.from);
                    console.log("CLEAN REGISTROS :  "+result_numero.length+"----"+JSON.stringify(result_numero))
                    if(result_numero===undefined || result_numero.length==0){
                        conversaciones=[];    
                    }else{
                        conversaciones = result_numero;
                    }  
                    // siempre dejamos el ultimo registro
                    conversaciones.push(conversacion_ingresado);                        
                }    
                console.log("conversaciones");
                console.log(JSON.stringify(conversaciones));
                
                if(mensaje_recibido==="fin"){
                    console.log("SET  FINALIZAE");
                    resolve("OK");
                }
    
            }catch(error){
                console.log('El error es : ', error);
            } 
        })()
        .catch()
        .finally()
        ;
    });
    client.initialize();

}
inicializar();
console.log("FIN START");

const getStandardResponsePost = async (code,message,data) => {
    return {
        code: code,
        message : message,
        data : data
     }
}

app.listen(app.get("port"), () => 
  console.log("app running on port", app.get("port"))
);  

async function echotest() {
    const date = new Date();
     console.log(date);
}
  






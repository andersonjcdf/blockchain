'use strict';
var CryptoJS = require("crypto-js");
var express = require("express");
var bodyParser = require('body-parser');
var WebSocket = require("ws");

var portaHttp = process.env.HTTP_PORT || 2222;
var portaP2P = process.env.P2P_PORT || 3333;
var peersIniciais = process.env.PEERS ? process.env.PEERS.split(',') : [];

class Block {
    constructor(indice, hashAnterior, timestamp, cpf, nome, apelido, nomeMae, endereco, telefone, hash) {
        this.indice = indice;
        this.hashAnterior = hashAnterior.toString();
        this.timestamp = timestamp;
        this.cpf = cpf;
        this.nome = nome;
        this.apelido = apelido;
        this.nomeMae = nomeMae;
        this.endereco = endereco;
        this.telefone = telefone;
        this.hash = hash;
    }
}

var sockets = [];
var MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
};

var getBlockInicial = () => {
    return new Block(0, "0", 562844700, "000.000.000-00", "Fulano da Silva", "Fulers", "Sicrana da Silva", "Brasilia-DF", "(55)5555-5555", "00098660297b319852f08946ebfef8026d4589c23f354f5bfd311dc23744fc64");
};

var blockchain = [getBlockInicial()];

var iniciarServidorHttp = () => {
    var app = express();
    app.use(bodyParser.json());

    app.get('/blocks', (req, res) => res.send(JSON.stringify(blockchain)));
    app.post('/mineBlock', (req, res) => {
        var novoBlock = gerarProximoBlock(req.body.cpf, req.body.nome, req.body.apelido, req.body.nomeMae, req.body.endereco, req.body.telefone);
        adicionarBlock(novoBlock);
        broadcast(responseUltimaMsg());
        console.log('block adicionado: ' + JSON.stringify(novoBlock));
        res.send();
    });
    app.get('/peers', (req, res) => {
        res.send(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        conectarAosPeers([req.body.peer]);
        res.send();
    });
    app.listen(portaHttp, () => console.log('Escutando http na porta: ' + portaHttp));
};


var iniciarServidorP2P = () => {
    var server = new WebSocket.Server({port: portaP2P});
    server.on('connection', ws => iniciarConexao(ws));
    console.log('escutando websocket p2p na porta: ' + portaP2P);

};

var iniciarConexao = (ws) => {
    sockets.push(ws);
    iniciarMessageHandler(ws);
    iniciarErrorHandler(ws);
    write(ws, queryChainLengthMsg());
};

var iniciarMessageHandler = (ws) => {
    ws.on('message', (dados) => {
        var message = JSON.parse(dados);
        console.log('Mensagem recebida' + JSON.stringify(message));
        switch (message.type) {
            case MessageType.QUERY_LATEST:
                write(ws, responseUltimaMsg());
                break;
            case MessageType.QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(message);
                break;
        }
    });
};

var iniciarErrorHandler = (ws) => {
    var fecharConexao = (ws) => {
        console.log('conexão falhou para o peer: ' + ws.url);
        sockets.splice(sockets.indexOf(ws), 1);
    };
    ws.on('close', () => fecharConexao(ws));
    ws.on('error', () => fecharConexao(ws));
};


var gerarProximoBlock = (cpf, nome, apelido, nomeMae, endereco, telefone) => {
    var blockAnterior = getUltimoBlock();
    var proximoIndice = blockAnterior.indice + 1;
    var proximoTimestamp = new Date().getTime() / 1000;
    var nome = nome;
    var apelido = apelido;
    var nomeMae = nomeMae;
    var endereco = endereco;
    var telefone = telefone;
    var proximoHash = calcularHash(proximoIndice, blockAnterior.hash, proximoTimestamp, cpf, nome, apelido, nomeMae, endereco, telefone);
    return new Block(proximoIndice, blockAnterior.hash, proximoTimestamp, cpf, nome, apelido, nomeMae, endereco, telefone, proximoHash);
};


var calcularHashParaBlock = (block) => {
    return calcularHash(block.indice, block.hashAnterior, block.timestamp, block.cpf, block.nome, block.apelido, block.nomeMae, block.endereco, block.telefone);
};

var calcularHash = (indice, hashAnterior, timestamp, cpf, nome, apelido, nomeMae, endereco, telefone) => {
    return CryptoJS.SHA256(indice + hashAnterior + timestamp + cpf + nome + apelido + nomeMae + endereco + telefone).toString();
};

var adicionarBlock = (novoBlock) => {
    if (isNovoBlockValido(novoBlock, getUltimoBlock())) {
        blockchain.push(novoBlock);
    }
};

var isNovoBlockValido = (novoBlock, blockAnterior) => {
    if (blockAnterior.indice + 1 !== novoBlock.indice) {
        console.log('índice inválido');
        return false;
    } else if (blockAnterior.hash !== novoBlock.hashAnterior) {
        console.log('hash anterior inválido');
        return false;
    } else if (calcularHashParaBlock(novoBlock) !== novoBlock.hash) {
        console.log(typeof (novoBlock.hash) + ' ' + typeof calcularHashParaBlock(novoBlock));
        console.log('hash inválido: ' + calcularHashParaBlock(novoBlock) + ' ' + novoBlock.hash);
        return false;
    }
    return true;
};

var conectarAosPeers = (newPeers) => {
    newPeers.forEach((peer) => {
        var ws = new WebSocket(peer);
        ws.on('open', () => iniciarConexao(ws));
        ws.on('error', () => {
            console.log('conexão falhou')
        });
    });
};

var handleBlockchainResponse = (message) => {
    var blockRecebido = JSON.parse(message.cpf).sort((b1, b2) => (b1.indice - b2.indice));
    var ultimoBlockRecebido = blockRecebido[blockRecebido.length - 1];
    var ultimoBlockGuardado = getUltimoBlock();
    if (ultimoBlockRecebido.indice > ultimoBlockGuardado.indice) {
        console.log('O blockchain não condiz com a posição correta. Posição atual: ' + ultimoBlockGuardado.indice + ' Posição do peer: ' + ultimoBlockRecebido.indice);
        if (ultimoBlockGuardado.hash === ultimoBlockRecebido.hashAnterior) {
            console.log("Esse block recebido será adicionado a nossa corrente");
            blockchain.push(ultimoBlockRecebido);
            broadcast(responseUltimaMsg());
        } else if (blockRecebido.length === 1) {
            console.log("A corrente será consultada no nosso peer.");
            broadcast(queryAllMsg());
        } else {
            console.log("Blockchain recebido é maior que o blockchain atual");
            trocarChain(blockRecebido);
        }
    } else {
        console.log('Blockchain recebido não é maior que o blockchain atual. Nada será feito!');
    }
};

var trocarChain = (novosBlocos) => {
    if (isChainValido(novosBlocos) && novosBlocos.length > blockchain.length) {
        console.log('O blockchain recebido é válido. O blockchain atual será substituído pelo blockchain recebido.');
        blockchain = novosBlocos;
        broadcast(responseUltimaMsg());
    } else {
        console.log('O blockchain recebido é inválido!');
    }
};

var isChainValido = (blockchainParaValidar) => {
    if (JSON.stringify(blockchainParaValidar[0]) !== JSON.stringify(getBlockInicial())) {
        return false;
    }
    var tempBlocks = [blockchainParaValidar[0]];
    for (var i = 1; i < blockchainParaValidar.length; i++) {
        if (isNovoBlockValido(blockchainParaValidar[i], tempBlocks[i - 1])) {
            tempBlocks.push(blockchainParaValidar[i]);
        } else {
            return false;
        }
    }
    return true;
};

var getUltimoBlock = () => blockchain[blockchain.length - 1];
var queryChainLengthMsg = () => ({'MessageType': MessageType.QUERY_LATEST});
var queryAllMsg = () => ({'MessageType': MessageType.QUERY_ALL});
var responseChainMsg = () =>({
    'MessageType': MessageType.RESPONSE_BLOCKCHAIN, 'dados': JSON.stringify(blockchain)
});
var responseUltimaMsg = () => ({
    'MessageType': MessageType.RESPONSE_BLOCKCHAIN,
    'dados': JSON.stringify([getUltimoBlock()])
});

var write = (ws, message) => ws.send(JSON.stringify(message));
var broadcast = (message) => sockets.forEach(socket => write(socket, message));

conectarAosPeers(peersIniciais);
iniciarServidorHttp();
iniciarServidorP2P();
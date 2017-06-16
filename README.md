# blockchain
Cadastro de Ficha Pessoal com o uso de blockchain usando node js.

Tutorial para acesso a Ficha Pessoal

MAC / LINUX

1 - Baixe os arquivos (fichaPessoal.js e package.json) para a pasta blockchain
2 - Via terminal, acesse a pasta blockchain e digite o comando abaixo:

npm install

3 - Caso não estejam instalados, digite os comandos abaixo:

npm install crypto-js
npm install body-parser
npm install express

Para verificar se o node e o npm estão instalados corretamente, digite os comandos abaixo:

node -v
npm -v

4 - Para iniciar o servidor, digite:

HTTP_PORT=2222 P2P_PORT=3333 npm start

5 - Para iniciar um peer, digite:

HTTP_PORT=4444 P2P_PORT=5555 PEERS=ws://localhost:3333 npm start

6 - Para criar mais um bloco, digite:

curl -H "Content-type:application/json" --data ‘{“cpf” : “123.456.789-10”}’ http://localhost:2222/mineBlock

Obs.: Adicione mais parâmetros separando por vírgulas. São eles: nome, apelido, nomeMae, endereço e telefone.

7 - Para mostrar os blocos do blockchain, digite:

curl http://localhost:2222/blocks

8 - Para adicionar mais um peer, digite:

curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:3333”}’ http://localhost:2222/addPeer

9 - Para mostrar todos os peers conectados, digite:

curl http://localhost:2222/peers

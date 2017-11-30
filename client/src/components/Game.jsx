import React, { Component } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import Chat from './Chat';
import Terminal from './Terminal';
import GameView from './GameView';
import GameOverView from './GameOverView';
import GameState from './GameState';
import Logo from './Logo';
import Team from './Team';
import css from '../styles.css';

import help from './../../../utils/helpers';

export default class Game extends Component {
  constructor(props) {
    super(props);

    this.state = {
      player1: false,
      player2: false,
      messageArray: [],
      name: null,
      pokemon: [],
      opponent: null,
      isActive: null,
      attacking: false,
      gameOver: false,
      winner: null,
      chatInput: '',
      commandInput: '',
      commandArray: [{ command: 'The game will begin shortly - type "help" to learn how to play' }],
      socket: null,
      teamConfirmed: false,
      freeSwitch: false,
      activeChoice: null,
      pokemonOptions: [],
    };

    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleChatInputSubmit = this.handleChatInputSubmit.bind(this);
    this.handleCommands = this.handleCommands.bind(this);
    this.handleConfirmTeam = this.handleConfirmTeam.bind(this);
    this.handleAttackClick = this.handleAttackClick.bind(this);
  }

  componentDidMount() {
    axios('/user')
      .then(({ data }) => {
        if (data.username) {
          const { username } = data;
          const socket = io();
          this.setState({
            name: username,
            socket,
          });
          const playerInit = {
            gameid: this.props.match.params.gameid,
            name: username,
            pokemon: this.state.pokemon,
          };
          socket.emit('join game', playerInit);
          socket.on('gamefull', message => alert(message));
          socket.on('chat message', this.socketHandlers().handleChat);
          socket.on('player', this.socketHandlers().playerInitialized);
          socket.on('ready', this.socketHandlers().handleReady);
          socket.on('attack processed', this.socketHandlers().attackProcess);
          socket.on('free switch', this.socketHandlers().freeSwitch);
          socket.on('turn move', this.socketHandlers().turnMove);
          socket.on('gameover', this.socketHandlers().gameOver);
        } else {
          this.props.history.replace('/login');
        }
      });
  }

  socketHandlers() {
    return {
      handleChat: (message) => {
        const messageInstance = {
          name: message.name,
          text: message.text,
        };
        this.setState(prevState => (
          { messageArray: prevState.messageArray.concat(messageInstance) }
        ));
      },
      playerInitialized: (data) => {
        this.setState({
          [data.player]: true,
          pokemon: data.pokemon,
        });
      },
      handleReady: (data) => {
        if (this.state.player1) {
          this.setState({
            isActive: true,
            opponent: data.player2,
          });
        } else {
          this.setState({
            isActive: false,
            opponent: data.player1,
          });
        }
        this.setState({ commandArray: [{ command: 'Let the battle begin!' }] });
      },
      attackProcess: (data) => {
        this.setState(prevState => (
          {
            commandArray: prevState.commandArray.concat(data.basicAttackDialog),
            freeSwitch: false,
          }
        ));
      },
      freeSwitch: (data) => {
        if (this.state.player1) {
          this.setState({
            freeSwitch: true,
            pokemon: data.player1.pokemon,
            opponent: data.player2,
          });
        } else {
          this.setState({
            freeSwitch: true,
            pokemon: data.player2.pokemon,
            opponent: data.player1,
          });
        }
      },
      turnMove: (data) => {
        if (this.state.player1) {
          // this.setState(prevState => (
          //   {
          //     pokemon: data.player1.pokemon,
          //     opponent: data.player2,
          //     isActive: !prevState.isActive,
          //   }
          // ));
          this.setState({
            pokemon: data.player1.pokemon,
            opponent: data.player2,
          });
        } else {
          // this.setState(prevState => (
          //   {
          //     pokemon: data.player2.pokemon,
          //     opponent: data.player1,
          //     isActive: !prevState.isActive,
          //   }
          // ));
          this.setState({
            pokemon: data.player2.pokemon,
            opponent: data.player1,
          });
        }
      },
      gameOver: (data) => {
        this.setState({
          winner: data.name,
          gameOver: true,
          isActive: false,
        });
        setTimeout(() => this.props.history.replace('/'), 20000);
      },
    };
  }

  handleInputChange(e, type) {
    // this if statement prevents the chat text area from expanding on submit (keyCode 13)
    if (e.target.value !== '\n') {
      this.setState({
        [type]: e.target.value,
      });
    }
  }

  handleChatInputSubmit(e) {
    if (e.keyCode === 13) {
      // const socket = io();
      this.state.socket.emit('chat message', {
        gameid: this.props.match.params.gameid,
        name: this.state.name,
        text: e.target.value,
      });
      this.setState({
        chatInput: '',
      });
    }
  }

  commandHandlers() {
    return {
      help: () => {
        this.setState(prevState => (
          {
            commandArray: prevState.commandArray.concat(help),
            commandInput: '',
          }
        ));
      },
      attack: () => {
        this.state.socket.emit('attack', {
          gameid: this.props.match.params.gameid,
          name: this.state.name,
          pokemon: this.state.pokemon,
        });
        this.setState({
          attacking: false,
        });
      },
      choose: (pokemonToSwap) => {
        let isAvailable = false;
        let index;
        let health;
        this.state.pokemon.forEach((poke, i) => {
          if (poke.name === pokemonToSwap) {
            isAvailable = true;
            index = i;
            ({ health } = poke);
          }
        });
        if (isAvailable && health > 0) {
          this.state.socket.emit('switch', {
            gameid: this.props.match.params.gameid,
            name: this.state.name,
            pokemon: this.state.pokemon,
            index,
            free: this.state.freeSwitch,
          });
          // this.setState({ freeSwitch: false });
        } else if (health === 0) {
          alert('That pokemon has fainted!');
        } else {
          alert('You do not have that pokemon!');
        }
      },
    };
  }

  handleCommands(e) {
    if (e.keyCode !== 13) return;
    const value = e.target.value.toLowerCase();

    if (value === 'help') {
      this.commandHandlers().help();
      return;
    }

    if (false && !this.state.isActive) {
      alert('it is not your turn!');
    } else if (value === 'attack') {
      // console.log(this.state.pokemon[0].health);
      if (this.state.pokemon[0].health <= 0) {
        alert('you must choose a new pokemon, this one has fainted!');
      } else if (this.state.freeSwitch) {
        alert('you must wait for your opponent to pick a new pokemon');
      } else {
        this.setState({
          attacking: true,
        });
        setTimeout(() => this.commandHandlers().attack(), 300);
      }
    } else if (value.split(' ')[0] === 'choose') {
      this.commandHandlers().choose(value.split(' ')[1]);
    } else {
      alert('invalid input!');
    }

    this.setState({
      commandInput: '',
    });
  }

  handleConfirmTeam() {
    this.setState({ teamConfirmed: true });
  }

  handleAttackClick() {
    if (this.state.pokemon[0].health <= 0) {
      alert('you must choose a new pokemon, this one has fainted!');
    } else if (this.state.freeSwitch) {
      alert('you must wait for your opponent to pick a new pokemon');
    } else {
      this.setState({
        attacking: true,
      });
      setTimeout(() => this.commandHandlers().attack(), 300);
    }
  }

  renderGame() {
    const {
      pokemon, opponent, winner, name, attacking,
    } = this.state;
    if (!this.state.opponent) {
      return (
        <div className={css.loading}>
          <h1>Awaiting opponent...</h1>
        </div>
      );
    } else if (this.state.gameOver) {
      return (
        <GameOverView pokemon={winner === name ? pokemon : opponent.pokemon} winner={winner} />
      );
    }
    return <GameView opponent={opponent} pokemon={pokemon} attacking={attacking} />;
  }

  renderSideBar() {
    return (
      <div className={css.stateContainer}>
        <Logo
          name={this.state.name}
          isActive={this.state.isActive}
          opponent={this.state.opponent}
        />
        <GameState pokemon={this.state.pokemon} handleChoose={this.commandHandlers().choose} />
        <Chat
          messageArray={this.state.messageArray}
          chatInput={this.state.chatInput}
          handleChatInputSubmit={this.handleChatInputSubmit}
          handleInputChange={this.handleInputChange}
        />
      </div>
    );
  }

  renderTeam() {
    return (
      <Team
        handleConfirm={this.handleConfirmTeam}
        pokemon={this.state.pokemon}
      />
    );
  }

  renderBattle() {
    return (
      <div className={css.gamePageContainer}>
        <div className={css.gameContainer}>
          {this.renderGame()}
          <Terminal
            commandArray={this.state.commandArray}
            commandInput={this.state.commandInput}
            handleCommands={this.handleCommands}
            handleInputChange={this.handleInputChange}
          />
          <button onClick={this.handleAttackClick}> attack </button>
        </div>
        {this.renderSideBar()}
      </div>
    );
  }

  render() {
    // const { players, spectators, gameOver, pokemon } = this.state;
    return (
      <div>
        {!this.state.teamConfirmed ? this.renderTeam() : this.renderBattle()}
      </div>
    );
  }
}

/*

        <div className={css.gameContainer}>
          {this.renderGame()}
          <Terminal
            commandArray={this.state.commandArray}
            commandInput={this.state.commandInput}
            handleCommands={this.handleCommands}
            handleInputChange={this.handleInputChange}
          />
        </div>
        {this.renderSideBar()}
      </div>
    );
  }
}
*/

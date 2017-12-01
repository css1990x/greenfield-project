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
      gameMessage: '',
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
      teamCount: 0,
    };

    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleChatInputSubmit = this.handleChatInputSubmit.bind(this);
    this.handleCommands = this.handleCommands.bind(this);
    this.handleConfirmTeam = this.handleConfirmTeam.bind(this);
    this.handleAttackClick = this.handleAttackClick.bind(this);
    this.handleSetActive = this.handleSetActive.bind(this);
    this.renderActive = this.renderActive.bind(this);
    this.handleAddPokemon = this.handleAddPokemon.bind(this);
    this.renderBattle = this.renderBattle.bind(this);
    this.renderOptions = this.renderOptions.bind(this);
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
        console.log(data.pokemon);
        this.setState({
          [data.player]: true,
          pokemonOptions: data.pokemon,
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
      attack: (moveIdx) => {
        this.state.socket.emit('attack', {
          gameid: this.props.match.params.gameid,
          name: this.state.name,
          pokemon: this.state.pokemon,
          moveIdx,
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
          this.setState({gameMessage: 'That pokemon has fainted!'});
          // alert('That pokemon has fainted!');
        } else {
          this.setState({gameMessage: 'You do not have that pokemon!'});
          // alert('You do not have that pokemon!');
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

    let moveIdx = -1;
    const { moves } = this.state.pokemon[0];
    for (let i = 0; i < moves.length; i += 1) {
      if (moves[i].name === value) {
        moveIdx = i;
        break;
      }
    }
    // console.log(value, moveIdx);
    // if (!this.state.isActive) {
    //   alert('it is not your turn!');
    // }
    if (moveIdx >= 0 || value === 'attack') {
      // console.log(this.state.pokemon[0].health);
      if (this.state.pokemon[0].health <= 0) {
        this.setState({ gameMessage: 'you must choose a new pokemon, this one has fainted!' });
        // alert('you must choose a new pokemon, this one has fainted!');
      } else if (this.state.freeSwitch) {
        this.setState({ gameMessage: 'you must wait for your opponent to pick a new pokemon' });
        // alert('you must wait for your opponent to pick a new pokemon');
      } else {
        this.setState({
          attacking: true,
        });
        setTimeout(() => this.commandHandlers().attack(moveIdx), 300);
      }
    } else if (value.split(' ')[0] === 'choose') {
      this.commandHandlers().choose(value.split(' ')[1]);
    } else {
      this.setState({gameMessage: 'invalid input!'});
      // alert('invalid input!');
    }

    this.setState({
      commandInput: '',
    });
  }

  handleSetActive(pokemon) {
    this.setState({ activeChoice: pokemon });
  }

  handleConfirmTeam() {
    if (this.state.teamCount === 3) {
      this.setState({ teamConfirmed: true });
      /*
      // do we need to handle whether or not this is coming from player 1 or player 2?
      socket.emit('team selected', { 'pokemon', this.state.pokemon })
      .then(function(data) {
        socket.on('opponent joined', function(data) {
          this.setState({ opponent: data.opponent });
        });
      });
      // when you get a confirmation from the server that its received and set the client's pokemon
      // the client should then wait to receive an object with the other player's selection
      */
    }
  }

  handleAttackClick(name) {
    let nameMap = this.state.pokemon[0].moves.map( m => m.name );
    let moveIdx = nameMap.indexOf(name);

    if (this.state.pokemon[0].health <= 0) {
      this.setState({gameMessage: 'you must choose a new pokemon, this one has fainted!'});
      // alert('you must choose a new pokemon, this one has fainted!');
    } else if (this.state.freeSwitch) {
      this.setState({gameMessage: 'you must wait for your opponent to pick a new pokemon'});
      // alert('you must wait for your opponent to pick a new pokemon');
    } else {
      this.setState({
        attacking: true,
      });
      setTimeout(() => this.commandHandlers().attack(moveIdx), 300);
    }
  }

  handleAddPokemon() {
    if (this.state.activeChoice) {
      if (this.state.teamCount < 3) {
        const teamArr = this.state.pokemon;
        teamArr.push(this.state.activeChoice);
        const newCount = this.state.teamCount + 1;
        this.setState({
          pokemon: teamArr,
          teamCount: newCount,
          activeChoice: null,
        });
      } else {
        console.log('Too many pokemon');
      }
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
          message={this.state.gameMessage}
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

  renderActive() {
    return (
      <div id="activePokemon" className={css.activeChoice}>
        <h3>{this.state.activeChoice.name}</h3>
        <div id="activePic">
          <img src={this.state.activeChoice.sprites.front_default} alt="" />
        </div>
        <div id="activeInfo">
          <h5 style={{ marginBottom: '0px', marginTop: '2px' }}>{`${this.state.activeChoice.name}'s Stats:`}</h5>
          <h6 style={{ marginBottom: '0px' }}>{`Health: ${this.state.activeChoice.health} / ${this.state.activeChoice.initialHealth}`}</h6>
          <h6 style={{ marginBottom: '0px' }}>{`Attack: ${this.state.activeChoice.attack}`}</h6>
          <h6 style={{ marginBottom: '0px' }}>{`Special Attack: ${this.state.activeChoice.specialAttack}`}</h6>
          <h6 style={{ marginBottom: '0px' }}>{`Defense: ${this.state.activeChoice.defense}`}</h6>
          <h6 style={{ marginBottom: '0px' }}>{`Special Defense: ${this.state.activeChoice.specialDefense}`}</h6>
          <h6 style={{ marginBottom: '0px' }}>{`Speed: ${this.state.activeChoice.speed}`}</h6>
        </div>
      </div>
    );
  }

  renderEmpty() {
    return (
      <div id="activePokemon" className={css.activeChoice}>
        <h3>Choose a Pokmeon to see its stats</h3>
        <div id="activePic" />
        <div id="activeInfo" />
      </div>
    );
  }

  renderOptions() {
    return (
      this.state.pokemonOptions.map((pokemon) => {
        return (
          <div style={{ display: 'inline-block', width: '150px' }} key={pokemon.name} onClick={() => this.handleSetActive(pokemon)}>
            <img src={pokemon.sprites.front_default} alt="" />
            <h5 style={{ marginBottom: '0px', marginTop: '2px' }}>{pokemon.name}</h5>
            <h6 style={{ marginBottom: '0px' }}>{pokemon.health} / {pokemon.initialHealth}</h6>
          </div>
        );
      })
    );
  }

  renderTeam() {
    return (
      <Team
        handleConfirm={this.handleConfirmTeam}
        pokemonOptions={this.state.pokemonOptions}
        pokemon={this.state.pokemon}
        handleSetActive={this.handleSetActive}
        choice={this.state.activeChoice}
        renderActive={this.renderActive}
        renderEmpty={this.renderEmpty}
        handleAddPokemon={this.handleAddPokemon}
        renderOptions={this.renderOptions}
        teamCount={this.state.teamCount}
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
          {this.state.pokemon[0].moves.map(move => {
            return <button className={css.gameButton} onClick={() => {this.handleAttackClick(move.name)}}> {move.name} </button>
          })}
          
        </div>
        {this.renderSideBar()}
      </div>
    );
  }

  render() {
    return (
      <div>
        {!this.state.teamConfirmed ? this.renderTeam() : this.renderBattle()}
      </div>
    );
  }
}

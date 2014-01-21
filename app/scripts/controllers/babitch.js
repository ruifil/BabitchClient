'use strict';

babitchFrontendApp.controller("babitchCtrl", function ($scope, $http, CONFIG, fayeClient) {

    $scope.gameStarted = false;
    $scope.playersList = [];

        fayeClient.subscribe(CONFIG.BABITCH_LIVE_FAYE_CHANNEL, function(data) {
        if (data.type == 'requestCurrentGame') {
            notify('currentGame');
        }
    });

    // Model Game object ready to be sent to the API
    var game = {
        red_score: 0,
        blue_score: 0,
        player: [
            { team: 'red', position: 'defense' },
            { team: 'blue', position: 'attack' },
            { team: 'red', position: 'attack' },
            { team: 'blue', position: 'defense' },
        ],
        goals: []
    };

    var notify = function(eventName) {
        if ($scope.gameStarted) {
            fayeClient.publish(CONFIG.BABITCH_LIVE_FAYE_CHANNEL, {type: eventName, gameId: $scope.gameId, game: $scope.game, players: $scope.game.player[0]});
        }
    }

    $scope.initGame = function () {
        $scope.gameStarted = false;
        $scope.game        = angular.copy(game);
        $scope.loadPlayer();
    };

    $scope.getPlayerBySeat = function (team, position) {
        var found;
        $scope.game.player.forEach(function(player) {
            if (player.team === team && player.position === position) {
                found = player;
            }
        });
        return found;
    };

    $scope.loadPlayer = function () {
        $http({
            url: CONFIG.BABITCH_WS_URL + '/players',
            method: 'GET'
        }).
        success(function(data) {
            $scope.playersList = data;
        });
    };

    $scope.startGame = function () {
        var valid = true;
        var playerAlreadySelect = [];

        $scope.game.player.forEach(function (player) {
            if (player.player_id == null || playerAlreadySelect.indexOf(player.player_id) > -1) {
                valid = false;
            }

            playerAlreadySelect.push(player.player_id);
        });

        if (valid) {
            $scope.gameId = Date.now();
            $scope.gameStarted = true;
            notify('start');
        }
    };

    $scope.coach = function (team) {
        var attack  = $scope.getPlayerBySeat(team, 'attack');
        var defense = $scope.getPlayerBySeat(team, 'defense');

        var tmpId = attack.player_id;
        attack.player_id = defense.player_id;
        defense.player_id = tmpId;
        notify('coach');
    };

    $scope.goal = function (player) {
        if ($scope.gameStarted) {
            $scope.game.goals.push({
                position: player.position,
                player_id: player.player_id,
                conceder_id: $scope.getPlayerBySeat(player.team === 'red' ? 'blue' : 'red', 'defense').player_id,
                autogoal: false
            });
            if (player.team == 'red') {
                $scope.game.red_score ++;
            } else {
                $scope.game.blue_score ++;
            }
            notify('goal');
        }
    };

    $scope.autogoal = function (player) {
        if ($scope.gameStarted) {
            $scope.game.goals.push({
                position: player.position,
                player_id: player.player_id,
                conceder_id: $scope.getPlayerBySeat(player.team, 'defense').player_id,
                autogoal: true
            });
            if (player.team == 'red') {
                $scope.game.blue_score ++;
            } else {
                $scope.game.red_score ++;
            }
            notify('autogoal');
        }
    };

    $scope.cancelGoal = function () {
        var lastGoal = $scope.game.goals.pop();
        var conceder = $scope.game.player.filter(function (p) {return p.player_id == lastGoal.conceder_id})[0];
        if (conceder.team == 'red') {
            $scope.game.blue_score--;
        } else {
            $scope.game.red_score--;
        }
        notify('cancel');
    };

    $scope.cancelGame = function () {
        $scope.gameStarted = false;
    };

    $scope.saveGame = function () {
        notify('end');
        $scope.gameStarted = false;
        $http({
            url: CONFIG.BABITCH_WS_URL + '/games',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: $scope.game
        }).
        success(function(data, status) {
            $scope.initGame();
        }).
        error(function (data, status) {
            if (status == 0) {
                setTimeout(function () {$scope.saveGame();}, 1000);
            }
        });
    };

    $scope.$watch('game.red_score', function() {
        if ($scope.game.red_score == 10) {
            $scope.saveGame();
        }
     });

    $scope.$watch('game.blue_score', function() {
        if ($scope.game.blue_score == 10) {
            $scope.saveGame();
        }
    });


     // Init Game
    $scope.initGame();
    })
  ;

import { RouteComponentProps } from '@reach/router';
import { Constants, Types } from '@hard2kill/gladiatorz-common';
import { GameMode } from '@hard2kill/gladiatorz-common/src/types';
import { Client } from 'colyseus.js';
import { RoomAvailable } from 'colyseus.js/lib/Room';
import qs from 'querystringify';
import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Separator, Space, Text, View } from '../../components';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { NameField } from './components/NameField';
import { NewGameField } from './components/NewGameField';
import { RoomsList } from './components/RoomsList';

interface HomeScreenProps extends RouteComponentProps {}

export function HomeScreen({ navigate }: HomeScreenProps) {
    const { userId } = useAuth();
    const [rooms, setRooms] = useState<Array<RoomAvailable<any>>>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const clientRef = useRef<Client>();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    async function fetchBalance() {
        if (!userId) return;
        const { data } = await supabase
            .from('balances')
            .select('balance')
            .eq('id', userId)
            .single();
        if (data) {
            setBalance(data.balance);
        }
    }

    useEffect(() => {
        try {
            const host = window.document.location.host.replace(/:.*/, '');
            const port = process.env.NODE_ENV !== 'production' ? Constants.WS_PORT : window.location.port;
            const url = `${window.location.protocol.replace('http', 'ws')}//${host}${port ? `:${port}` : ''}`;

            clientRef.current = new Client(url);
            intervalRef.current = setInterval(updateRooms, Constants.ROOM_REFRESH);

            updateRooms();
            if (userId) {
                fetchBalance();
            }
        } catch (error) {
            console.error(error);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    //
    // Utils
    //
    async function updateRooms() {
        if (!clientRef.current) {
            return;
        }

        const rooms = await clientRef.current.getAvailableRooms(Constants.ROOM_NAME);
        setRooms(rooms);
    }

    //
    // Handlers
    //
    function handleRoomCreate(name: string, maxPlayers: number, map: string, mode: GameMode) {
        const playerName = localStorage.getItem('playerName') || '';

        const options: Types.RoomOptions = {
            playerName,
            roomName: name,
            roomMap: map,
            roomMaxPlayers: maxPlayers,
            mode,
        };

        navigate(`/new${qs.stringify(options, true)}`);
    }

    function handleRoomClick(roomId: string) {
        navigate(`/${roomId}`);
    }

    async function handleLogout() {
        console.log("signing out")
        await supabase.auth.signOut();
        window.location.reload();
    }

    return (
        <View
            flex
            center
            style={{
                padding: 32,
                flexDirection: 'column',
                justifyContent: 'center',
            }}
        >
            <View style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white' }}>Balance: ${balance ?? '...'}</Text>
                <Button text="Logout" onClick={handleLogout} />
            </View>
            <Header />
            <Space size="m" />
            <NameField />
            <Space size="m" />
            <Box
                style={{
                    width: 500,
                    maxWidth: '100%',
                }}
            >
                <NewGameField onCreate={handleRoomCreate} />
                <Space size="xxs" />
                <Separator />
                <Space size="xxs" />
                <RoomsList rooms={rooms} onRoomClick={handleRoomClick} />
                <Space size="xxs" />
            </Box>
        </View>
    );
}

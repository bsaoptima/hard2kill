import { Constants } from '@hard2kill/gladiatorz-common';
import React from 'react';
import { Helmet } from 'react-helmet';
import { Space, Text, View } from '../../../components';
import { titleImage } from '../../../images';

export function Header(): React.ReactElement {
    return (
        <>
            <Helmet>
                <title>{`${Constants.APP_TITLE} - Home`}</title>
                <meta
                    name="description"
                    content="The Open-Source IO Shooter is an open-source multiplayer game in the browser meant to be hostable, modifiable, and playable by anyone."
                />
            </Helmet>

            <View
                flex
                center
                column
                style={{
                    width: 700,
                    maxWidth: '100%',
                }}
            >
                <Space size="xs" />

                <Space size="xxs" />
            </View>
        </>
    );
}

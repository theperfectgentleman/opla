import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledButton = styled(TouchableOpacity);

export const OplaButton = ({ onPress, title }: { onPress: () => void; title: string }) => {
    return (
        <StyledButton
            className="bg-primary px-6 py-3 rounded-lg active:opacity-80"
            onPress={onPress}
        >
            <StyledText className="text-primary-foreground font-bold text-lg text-center">
                {title}
            </StyledText>
        </StyledButton>
    );
};

export const OplaCard = ({ children, title }: { children: React.ReactNode; title: string }) => {
    return (
        <StyledView className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <StyledText className="text-xl font-bold text-card-foreground mb-4">{title}</StyledText>
            {children}
        </StyledView>
    );
};

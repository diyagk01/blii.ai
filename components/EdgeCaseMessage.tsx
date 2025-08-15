import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EdgeCaseAction, EdgeCaseMessage } from '../services/edge-case-messaging';

interface EdgeCaseMessageProps {
  edgeCase: EdgeCaseMessage;
  onActionPress: (action: EdgeCaseAction) => void;
  style?: any;
}

const EdgeCaseMessageComponent: React.FC<EdgeCaseMessageProps> = ({
  edgeCase,
  onActionPress,
  style
}) => {
  const getActionIcon = (iconEmoji: string): any => {
    // Map emoji icons to Ionicons for consistency
    const iconMap: Record<string, string> = {
      '📝': 'create-outline',
      '🔖': 'bookmark-outline',
      '👁️': 'eye-outline',
      '⏰': 'time-outline',
      '↗️': 'open-outline',
      '📂': 'folder-outline'
    };
    
    return iconMap[iconEmoji] || 'help-outline';
  };

  const getActionColor = (actionType: string): string => {
    const colorMap: Record<string, string> = {
      'note': '#007AFF',
      'tag': '#FF9500',
      'reminder': '#FF3B30',
      'open': '#34C759',
      'organize': '#AF52DE',
      'view': '#007AFF'
    };
    
    return colorMap[actionType] || '#007AFF';
  };

  return (
    <View style={[styles.container, style]}>
      {/* AI Message */}
      <View style={styles.messageContainer}>
        <View style={styles.aiIconContainer}>
          <Ionicons name="sparkles" size={16} color="#A259FF" />
        </View>
        <Text style={styles.messageText}>{edgeCase.message}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {edgeCase.actions.map((action, index) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionButton,
              { borderColor: getActionColor(action.type) }
            ]}
            onPress={() => onActionPress(action)}
            activeOpacity={0.7}
          >
            <View style={styles.actionContent}>
              <Ionicons 
                name={getActionIcon(action.icon)} 
                size={14} 
                color={getActionColor(action.type)} 
              />
              <Text style={[
                styles.actionText,
                { color: getActionColor(action.type) }
              ]}>
                {action.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  aiIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(162, 89, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    fontFamily: 'SF Pro',
    fontWeight: '400',
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    marginRight: 4,
    marginBottom: 4,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'SF Pro',
  },
});

export default EdgeCaseMessageComponent;

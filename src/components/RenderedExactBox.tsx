import type { ExactBox } from '../types/old/shared/populator';
import { Box, Typography } from '@mui/material';

function RenderedExactBox({ box }: { box: ExactBox }) {
    // UILabel follows the format courseCode - courseName
    const [courseCode, courseName] = box.UILabel.split(" - ", 2);
    return (
        <Box sx={{
            border: '1px solid #556DCC',
            borderRadius: 2,
            padding: 1,
            width: 240,
            height: 120,
            backgroundColor: "#556DCC40", // 25% opacity blue
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'stretch',
        }}>
            <Typography variant="subtitle1" fontWeight={700} align="center" sx={{ fontSize: '1.2rem', mb: 0.5 }}>
                {courseCode}
            </Typography>
            <Typography variant="body2" align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '1rem' }}>
                {courseName}
            </Typography>
        </Box>
    );
}

export default RenderedExactBox;
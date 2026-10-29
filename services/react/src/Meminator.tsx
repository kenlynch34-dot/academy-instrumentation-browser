import { useState } from "react";
import {features} from './features';
import {getSession, updateExpireTime} from './session-management';
import {getUserName} from './user-identity';
export default function Meminator() {

    const [image, setImage] = useState<{ blob: Blob, url: string } | null>(null);
    const [phrase, setPhrase] = useState<string>('');
    const [fetching, setFetching] = useState<boolean>(false);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        updateExpireTime();
        fetchMeme();
      };

    const fetchMeme = async () => {
        setFetching(true);
        try {
            const response = await fetch('/api/createPicture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: phrase ? JSON.stringify({phrase: phrase}) : null
            });
            const blob = await response.blob();
            setImage((previous) => {
                if (previous) URL.revokeObjectURL(previous.url); // free the last meme's memory
                return { blob, url: URL.createObjectURL(blob) };
            });
        } catch (e) {
            alert("that was bad...");
        } finally {
            setFetching(false);
        }
    };

    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        const phraseText = event.target.value;
        if (event.target.value) {
            setPhrase(phraseText)
        } else {
            setPhrase('')
        }
    }

    return (
        <div>
            <p id="user-session">{getUserName()} = {getSession()}</p>
            { features.ALLOW_USER_QUESTIONS ?
                <>
                    <h3>Enter a phrase, then click 'GO'!</h3>
                    <div className="block">
                        <input id="meme" onChange={handleChange} />
                        <button id="self-meme" disabled={fetching} onClick={handleClick}>GO</button>
                    </div>
                </>
                :
                <>
                    <button id="self-meme" disabled={fetching} onClick={handleClick}>Generate Meme!</button>
                </>
            }
            <div>&nbsp;</div>
            <div className="block">
                { image && <img src={image.url} alt="meme" /> }
            </div>
            { image?.blob.type.startsWith('image/') &&
                <div className="block">
                    <a id="download-meme" href={image.url} target="_blank" rel="noopener">Download image</a>
                </div>
            }
        </div>
    );
}

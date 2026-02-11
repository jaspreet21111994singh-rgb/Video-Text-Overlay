import { useState } from 'react'
import viteLogo from '/vite.svg'
import reactLogo from './assets/react.svg'

function GifExpertApp() {
  const [categories, setCategories] = useState(['One Punch', 'Dragon Ball']);
  const onAddCategory =() => {
    setCategories(['Valorant', ...categories]);    
  }
  return (
    <div className="GifExpertApp">      
      <h1>GifExpertApp</h1>  
      <button onClick ={onAddCategory}>AGREGAR</button> 
      <ol>
        {
          categories.map(category =>{
            return <li key = {category}> {category} </li>
          }
        )}
      </ol>
    </div>
  )
}
export default GifExpertApp
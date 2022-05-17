import React from "react"

const Technology = (props) => {
    return (
        <div className="project-tech interactable bg-danger px-2 my-2 align-items-center rounded-pill">
            <p>{props.tech}</p>
        </div>
    )
}

export default Technology